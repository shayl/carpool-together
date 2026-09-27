import { z } from "zod";
import {
  hasCoordinates,
  optimizeStops,
  type GeoStop,
} from "@/lib/route-optimizer";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const routeSchema = z.object({
  eventId: z.string().uuid(),
  leg: z.enum(["to_event", "from_event"]),
});

type CoordinateRecord = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/routes">,
) {
  try {
    const { groupId } = await context.params;
    const input = routeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json({ error: "Invalid route request." }, { status: 400 });
    }

    const { admin } = await requireGroupRole(groupId, [
      "owner",
      "admin",
      "coordinator",
      "member",
    ]);
    const { data: event, error: eventError } = await admin
      .from("group_events")
      .select(
        "id, event_date, event_type, location_id, needs_to, needs_from",
      )
      .eq("group_id", groupId)
      .eq("id", input.data.eventId)
      .single();
    if (eventError || !event) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    if (
      (input.data.leg === "to_event" && !event.needs_to) ||
      (input.data.leg === "from_event" && !event.needs_from)
    ) {
      return Response.json(
        { error: "That ride is not required." },
        { status: 400 },
      );
    }

    if (event.event_type === "practice") {
      const { data: groupBreak, error: breakError } = await admin
        .from("group_breaks")
        .select("id")
        .eq("group_id", groupId)
        .lte("starts_on", event.event_date)
        .gte("ends_on", event.event_date)
        .limit(1)
        .maybeSingle();
      if (breakError) throw breakError;
      if (groupBreak) {
        return Response.json(
          { error: "This event is inside a group break." },
          { status: 400 },
        );
      }
    }

    const [
      locationResult,
      householdsResult,
      participantsResult,
      attendanceResult,
      absencesResult,
      claimResult,
    ] = await Promise.all([
      admin
        .from("group_locations")
        .select("id, name, address, latitude, longitude")
        .eq("group_id", groupId)
        .eq("id", event.location_id)
        .single(),
      admin
        .from("group_households")
        .select("id, name, address, latitude, longitude")
        .eq("group_id", groupId),
      admin
        .from("participants")
        .select("id, household_id")
        .eq("group_id", groupId),
      admin
        .from("group_event_attendance")
        .select(
          "participant_id, absent, opt_out_to, opt_out_from, updated_at",
        )
        .eq("group_id", groupId)
        .eq("event_id", event.id),
      admin
        .from("group_absence_periods")
        .select("participant_id, created_at")
        .eq("group_id", groupId)
        .lte("starts_on", event.event_date)
        .gte("ends_on", event.event_date),
      admin
        .from("group_ride_claims")
        .select("household_id")
        .eq("group_id", groupId)
        .eq("event_id", event.id)
        .eq("leg", input.data.leg)
        .maybeSingle(),
    ]);

    for (const result of [
      locationResult,
      householdsResult,
      participantsResult,
      attendanceResult,
      absencesResult,
      claimResult,
    ]) {
      if (result.error) throw result.error;
    }
    if (!claimResult.data) {
      return Response.json(
        { error: "A family must claim this ride before routing." },
        { status: 400 },
      );
    }

    const riderHouseholdIds = new Set(
      (participantsResult.data ?? [])
        .filter((participant) => {
          const daily = (attendanceResult.data ?? []).find(
            (item) => item.participant_id === participant.id,
          );
          const latestAbsence = (absencesResult.data ?? [])
            .filter((period) => period.participant_id === participant.id)
            .sort((left, right) =>
              right.created_at.localeCompare(left.created_at),
            )[0];
          const absenceApplies =
            latestAbsence &&
            (!daily || daily.updated_at < latestAbsence.created_at);
          if (absenceApplies || daily?.absent) return false;
          return input.data.leg === "to_event"
            ? !daily?.opt_out_to
            : !daily?.opt_out_from;
        })
        .map((participant) => participant.household_id),
    );
    if (!riderHouseholdIds.size) {
      return Response.json(
        { error: "No members currently need this ride." },
        { status: 400 },
      );
    }

    const households = householdsResult.data ?? [];
    const driver = households.find(
      (household) => household.id === claimResult.data?.household_id,
    );
    if (!driver) {
      return Response.json(
        { error: "Driving family not found." },
        { status: 404 },
      );
    }
    const passengerHouseholds = households.filter(
      (household) =>
        riderHouseholdIds.has(household.id) && household.id !== driver.id,
    );
    const location = locationResult.data;
    if (!location) {
      return Response.json(
        { error: "Event venue not found." },
        { status: 404 },
      );
    }
    const locationStop = await resolveStop(
      admin,
      groupId,
      { ...location, label: location.name },
      "group_locations",
    );
    const driverStop = await resolveStop(
      admin,
      groupId,
      { ...driver, label: driver.name },
      "group_households",
    );
    const passengerStops = await Promise.all(
      passengerHouseholds.map((household) =>
        resolveStop(
          admin,
          groupId,
          { ...household, label: household.name },
          "group_households",
        ),
      ),
    );
    const stops =
      input.data.leg === "from_event"
        ? optimizeStops(locationStop, passengerStops, driverStop)
        : optimizeStops(driverStop, passengerStops, locationStop);

    return Response.json({
      leg: input.data.leg,
      stops,
      optimized: stops.every(hasCoordinates),
    });
  } catch (error) {
    return apiError(error);
  }
}

async function resolveStop(
  admin: Awaited<ReturnType<typeof requireGroupRole>>["admin"],
  groupId: string,
  record: CoordinateRecord & { label: string },
  table: "group_locations" | "group_households",
): Promise<GeoStop> {
  if (!record.address.trim()) {
    throw Response.json(
      {
        error:
          "Add missing household and venue addresses before opening this route.",
      },
      { status: 400 },
    );
  }
  if (record.latitude !== null && record.longitude !== null) {
    return {
      label: record.label,
      address: record.address,
      latitude: record.latitude,
      longitude: record.longitude,
    };
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: record.address,
    format: "jsonv2",
    limit: "1",
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "CarpoolTogether/1.0",
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    });
  } catch {
    return unresolvedStop(record);
  }
  if (!response.ok) {
    return unresolvedStop(record);
  }
  const [result] = (await response.json().catch(() => [])) as Array<{
    lat: string;
    lon: string;
  }>;
  if (!result) {
    return unresolvedStop(record);
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  const { error } = await admin
    .from(table)
    .update({ latitude, longitude })
    .eq("group_id", groupId)
    .eq("id", record.id);
  if (error) throw error;

  return {
    label: record.label,
    address: record.address,
    latitude,
    longitude,
  };
}

function unresolvedStop(
  record: CoordinateRecord & { label: string },
): GeoStop {
  return {
    label: record.label,
    address: record.address,
    latitude: null,
    longitude: null,
  };
}
