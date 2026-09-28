import { z } from "zod";
import { requireGroupRecord } from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const mergeSchema = z
  .object({
    mergeRosterEntryId: z.string().uuid(),
    intoRosterEntryId: z.string().uuid(),
  })
  .refine(
    (value) => value.mergeRosterEntryId !== value.intoRosterEntryId,
    { message: "Choose two different members." },
  );

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/households/merge">,
) {
  try {
    const { groupId } = await context.params;
    const input = mergeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Choose two different members to combine." },
        { status: 400 },
      );
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);

    const { data: rosterEntries, error: rosterError } = await admin
      .from("group_access_roster")
      .select("id, household_id")
      .eq("group_id", groupId)
      .in("id", [input.data.mergeRosterEntryId, input.data.intoRosterEntryId]);
    if (rosterError) throw rosterError;

    const byId = new Map(rosterEntries?.map((entry) => [entry.id, entry]));
    const mergeEntry = byId.get(input.data.mergeRosterEntryId);
    const intoEntry = byId.get(input.data.intoRosterEntryId);
    if (!mergeEntry || !intoEntry) {
      return Response.json(
        { error: "Member not found in this group." },
        { status: 404 },
      );
    }
    if (!mergeEntry.household_id || !intoEntry.household_id) {
      return Response.json(
        { error: "One of these members has no household." },
        { status: 409 },
      );
    }
    if (mergeEntry.household_id === intoEntry.household_id) {
      return Response.json(
        { error: "These members already share a household." },
        { status: 409 },
      );
    }

    const keepHouseholdId = intoEntry.household_id;
    const oldHouseholdId = mergeEntry.household_id;
    await requireGroupRecord(
      admin,
      "group_households",
      groupId,
      keepHouseholdId,
    );

    // Move the merged member's roster entry, riders, and existing ride claims
    // onto the kept household, then drop the now-empty household.
    const { error: rosterUpdateError } = await admin
      .from("group_access_roster")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .eq("id", mergeEntry.id);
    if (rosterUpdateError) throw rosterUpdateError;

    const { error: participantsError } = await admin
      .from("participants")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .eq("household_id", oldHouseholdId);
    if (participantsError) throw participantsError;

    const { error: claimsError } = await admin
      .from("group_ride_claims")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .eq("household_id", oldHouseholdId);
    if (claimsError) throw claimsError;

    const { error: householdDeleteError } = await admin
      .from("group_households")
      .delete()
      .eq("group_id", groupId)
      .eq("id", oldHouseholdId);
    if (householdDeleteError) throw householdDeleteError;

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
