import { z } from "zod";
import { requireGroupRecord } from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const mergeSchema = z
  .object({
    rosterEntryIds: z.array(z.string().uuid()).min(2).max(12),
    // Optional: which member's household survives. Defaults to the first.
    intoRosterEntryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (value) =>
      new Set(value.rosterEntryIds).size === value.rosterEntryIds.length,
    { message: "Choose each member only once." },
  )
  .refine(
    (value) =>
      !value.intoRosterEntryId ||
      value.rosterEntryIds.includes(value.intoRosterEntryId),
    { message: "The kept household must be one of the selected members." },
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
        { error: "Choose at least two members to combine." },
        { status: 400 },
      );
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);

    const { data: rosterEntries, error: rosterError } = await admin
      .from("group_access_roster")
      .select("id, household_id, display_name")
      .eq("group_id", groupId)
      .in("id", input.data.rosterEntryIds);
    if (rosterError) throw rosterError;

    if ((rosterEntries ?? []).length !== input.data.rosterEntryIds.length) {
      return Response.json(
        { error: "Member not found in this group." },
        { status: 404 },
      );
    }
    if ((rosterEntries ?? []).some((entry) => !entry.household_id)) {
      return Response.json(
        { error: "One of these members has no household." },
        { status: 409 },
      );
    }

    const keepEntryId =
      input.data.intoRosterEntryId ?? input.data.rosterEntryIds[0];
    const keepHouseholdId = (rosterEntries ?? []).find(
      (entry) => entry.id === keepEntryId,
    )!.household_id as string;
    const mergedHouseholdIds = [
      ...new Set(
        (rosterEntries ?? [])
          .map((entry) => entry.household_id as string)
          .filter((id) => id !== keepHouseholdId),
      ),
    ];

    if (mergedHouseholdIds.length === 0) {
      return Response.json(
        { error: "These members already share a household." },
        { status: 409 },
      );
    }

    await requireGroupRecord(
      admin,
      "group_households",
      groupId,
      keepHouseholdId,
    );

    // Move every selected member's roster entry, riders, and existing ride
    // claims onto the kept household, then drop the now-empty households.
    // Deleting a household cascades to its roster entries, so the moves must
    // all land first.
    const { error: rosterUpdateError } = await admin
      .from("group_access_roster")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .in("household_id", mergedHouseholdIds);
    if (rosterUpdateError) throw rosterUpdateError;

    const { error: participantsError } = await admin
      .from("participants")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .in("household_id", mergedHouseholdIds);
    if (participantsError) throw participantsError;

    const { error: claimsError } = await admin
      .from("group_ride_claims")
      .update({ household_id: keepHouseholdId })
      .eq("group_id", groupId)
      .in("household_id", mergedHouseholdIds);
    if (claimsError) throw claimsError;

    const { error: householdDeleteError } = await admin
      .from("group_households")
      .delete()
      .eq("group_id", groupId)
      .in("id", mergedHouseholdIds);
    if (householdDeleteError) throw householdDeleteError;

    // Default the combined household to "A & B" unless a name was supplied.
    const combinedName =
      input.data.name ??
      (rosterEntries ?? [])
        .map((entry) => entry.display_name as string)
        .join(" & ");
    const { error: nameError } = await admin
      .from("group_households")
      .update({ name: combinedName, updated_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("id", keepHouseholdId);
    if (nameError) throw nameError;

    return Response.json({ ok: true, householdId: keepHouseholdId });
  } catch (error) {
    return apiError(error);
  }
}
