import { z } from "zod";
import {
  currentHouseholdId,
  requireActiveGroupMember,
  requireGroupRecord,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const claimSchema = z.object({
  eventId: z.string().uuid(),
  leg: z.enum(["to_event", "from_event"]),
  householdId: z.string().uuid().optional(),
  driverRosterEntryId: z.string().uuid().optional(),
});
const releaseSchema = z.object({
  eventId: z.string().uuid(),
  leg: z.enum(["to_event", "from_event"]),
  householdId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/claims">,
) {
  try {
    const { groupId } = await context.params;
    const input = claimSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid ride claim." }, { status: 400 });
    }
    const { admin, userId } = await requireActiveGroupMember(groupId);
    // Picking a driver implies their household, so the claim still belongs to
    // the family even when another member books it.
    let householdId = input.data.householdId;
    const driverRosterEntryId = input.data.driverRosterEntryId ?? null;
    if (driverRosterEntryId) {
      const { data: driver, error: driverError } = await admin
        .from("group_access_roster")
        .select("household_id")
        .eq("group_id", groupId)
        .eq("id", driverRosterEntryId)
        .eq("active", true)
        .maybeSingle();
      if (driverError) throw driverError;
      if (!driver?.household_id) {
        return Response.json(
          { error: "That driver is not available." },
          { status: 404 },
        );
      }
      householdId = driver.household_id as string;
    }
    if (!householdId) {
      householdId = await currentHouseholdId(admin, groupId, userId);
    }
    const [{ data: event, error: eventError }] = await Promise.all([
      admin
        .from("group_events")
        .select("needs_to, needs_from")
        .eq("group_id", groupId)
        .eq("id", input.data.eventId)
        .maybeSingle(),
      requireGroupRecord(admin, "group_households", groupId, householdId),
    ]);
    if (eventError) throw eventError;
    if (!event) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    if (
      (input.data.leg === "to_event" && !event.needs_to) ||
      (input.data.leg === "from_event" && !event.needs_from)
    ) {
      return Response.json(
        { error: "That ride leg is not required." },
        { status: 400 },
      );
    }
    const { data, error } = await admin
      .from("group_ride_claims")
      .insert({
        group_id: groupId,
        event_id: input.data.eventId,
        leg: input.data.leg,
        household_id: householdId,
        driver_roster_entry_id: driverRosterEntryId,
        claimed_by: userId,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      return Response.json(
        { error: "That ride leg has already been claimed." },
        { status: 409 },
      );
    }
    if (error) throw error;
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/claims">,
) {
  try {
    const { groupId } = await context.params;
    const input = releaseSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json({ error: "Invalid ride claim." }, { status: 400 });
    }
    const { admin } = await requireActiveGroupMember(groupId);
    const { error } = await admin
      .from("group_ride_claims")
      .delete()
      .eq("group_id", groupId)
      .eq("event_id", input.data.eventId)
      .eq("leg", input.data.leg);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
