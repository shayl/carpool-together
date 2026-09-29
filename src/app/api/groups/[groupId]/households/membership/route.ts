import { z } from "zod";
import { requireGroupRecord } from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const membershipSchema = z.object({
  rosterEntryId: z.string().uuid(),
  // A household to join, or null to move out into a household of their own.
  householdId: z.string().uuid().nullable(),
});

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/households/membership">,
) {
  try {
    const { groupId } = await context.params;
    const input = membershipSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Choose who to move and where." },
        { status: 400 },
      );
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data: entry, error: entryError } = await admin
      .from("group_access_roster")
      .select("id, display_name, household_id")
      .eq("group_id", groupId)
      .eq("id", input.data.rosterEntryId)
      .eq("active", true)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entry) {
      return Response.json(
        { error: "Member not found in this group." },
        { status: 404 },
      );
    }

    const currentHousehold = entry.household_id as string | null;
    if (currentHousehold === input.data.householdId) {
      return Response.json({ ok: true });
    }

    let targetHouseholdId = input.data.householdId;
    if (targetHouseholdId) {
      await requireGroupRecord(
        admin,
        "group_households",
        groupId,
        targetHouseholdId,
      );
    } else {
      // Moving out: everyone belongs to a household, so give them their own.
      const { data: created, error: createError } = await admin
        .from("group_households")
        .insert({
          group_id: groupId,
          name: entry.display_name,
          address: "",
        })
        .select("id")
        .single();
      if (createError) throw createError;
      targetHouseholdId = created.id as string;
    }

    const { error: moveError } = await admin
      .from("group_access_roster")
      .update({ household_id: targetHouseholdId })
      .eq("group_id", groupId)
      .eq("id", entry.id);
    if (moveError) throw moveError;

    // Riders provisioned for this person follow them; riders belonging to the
    // rest of the family stay put.
    const { error: ridersError } = await admin
      .from("participants")
      .update({ household_id: targetHouseholdId })
      .eq("group_id", groupId)
      .eq("roster_entry_id", entry.id);
    if (ridersError) throw ridersError;

    // Drop the old household once nothing references it, so the list does not
    // fill with empty families.
    if (currentHousehold) {
      const [{ count: members }, { count: riders }] = await Promise.all([
        admin
          .from("group_access_roster")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("household_id", currentHousehold),
        admin
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("household_id", currentHousehold),
      ]);
      if ((members ?? 0) === 0 && (riders ?? 0) === 0) {
        const { error: cleanupError } = await admin
          .from("group_households")
          .delete()
          .eq("group_id", groupId)
          .eq("id", currentHousehold);
        if (cleanupError) throw cleanupError;
      }
    }

    return Response.json({ ok: true, householdId: targetHouseholdId });
  } catch (error) {
    return apiError(error);
  }
}
