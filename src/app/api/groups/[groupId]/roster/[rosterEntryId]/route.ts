import { apiError, requireGroupRole } from "@/lib/server-auth";

// Removing a person keeps their history by default: rides they drove and
// their drive count still refer to the roster entry. `?purge=1` deletes the
// entry outright, which is only allowed when nothing references it.
export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/roster/[rosterEntryId]">,
) {
  try {
    const { groupId, rosterEntryId } = await context.params;
    const purge = new URL(request.url).searchParams.get("purge") === "1";
    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);

    const { data: entry, error: entryError } = await admin
      .from("group_access_roster")
      .select("id, role, household_id, active")
      .eq("group_id", groupId)
      .eq("id", rosterEntryId)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entry) {
      return Response.json(
        { error: "Member not found in this group." },
        { status: 404 },
      );
    }

    if (entry.role === "owner") {
      const { count, error: countError } = await admin
        .from("group_access_roster")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("role", "owner")
        .eq("active", true);
      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        return Response.json(
          { error: "A group needs at least one owner." },
          { status: 409 },
        );
      }
    }

    const householdId = entry.household_id as string | null;

    if (purge) {
      // Claims driven by this person would lose their driver, and past rides
      // should keep naming whoever drove them.
      const { count: claims, error: claimsError } = await admin
        .from("group_ride_claims")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("driver_roster_entry_id", rosterEntryId);
      if (claimsError) throw claimsError;
      if ((claims ?? 0) > 0) {
        return Response.json(
          {
            error:
              "This person has driven rides. Remove them instead of deleting.",
          },
          { status: 409 },
        );
      }

      // Households cascade-delete from their anchor roster entry, so hand the
      // household to another member first rather than losing the family.
      if (householdId) {
        const { data: household, error: householdError } = await admin
          .from("group_households")
          .select("id, roster_entry_id")
          .eq("group_id", groupId)
          .eq("id", householdId)
          .maybeSingle();
        if (householdError) throw householdError;

        if (household?.roster_entry_id === rosterEntryId) {
          const { data: successor, error: successorError } = await admin
            .from("group_access_roster")
            .select("id")
            .eq("group_id", groupId)
            .eq("household_id", householdId)
            .neq("id", rosterEntryId)
            .limit(1)
            .maybeSingle();
          if (successorError) throw successorError;

          const { error: reanchorError } = await admin
            .from("group_households")
            .update({ roster_entry_id: successor?.id ?? null })
            .eq("group_id", groupId)
            .eq("id", householdId);
          if (reanchorError) throw reanchorError;
        }
      }

      const { error: membershipError } = await admin
        .from("group_memberships")
        .delete()
        .eq("group_id", groupId)
        .eq("roster_entry_id", rosterEntryId);
      if (membershipError) throw membershipError;

      const { error: deleteError } = await admin
        .from("group_access_roster")
        .delete()
        .eq("group_id", groupId)
        .eq("id", rosterEntryId);
      if (deleteError) throw deleteError;
    } else {
      const { error: deactivateError } = await admin
        .from("group_access_roster")
        .update({ active: false })
        .eq("group_id", groupId)
        .eq("id", rosterEntryId);
      if (deactivateError) throw deactivateError;

      // Their device should stop seeing the group, but the roster entry stays
      // so re-adding the same phone restores them.
      const { error: membershipError } = await admin
        .from("group_memberships")
        .update({ status: "suspended" })
        .eq("group_id", groupId)
        .eq("roster_entry_id", rosterEntryId);
      if (membershipError) throw membershipError;
    }

    // Drop the household if this was its last member and nobody rides from it.
    if (householdId) {
      const [{ count: members }, { count: riders }] = await Promise.all([
        admin
          .from("group_access_roster")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("household_id", householdId)
          .eq("active", true),
        admin
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("household_id", householdId),
      ]);
      if ((members ?? 0) === 0 && (riders ?? 0) === 0) {
        const { error: cleanupError } = await admin
          .from("group_households")
          .delete()
          .eq("group_id", groupId)
          .eq("id", householdId);
        if (cleanupError) throw cleanupError;
      }
    }

    return Response.json({ ok: true, purged: purge });
  } catch (error) {
    return apiError(error);
  }
}
