import { z } from "zod";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const roleSchema = z.object({
  rosterEntryId: z.string().uuid(),
  role: z.enum(["owner", "admin", "coordinator", "member"]),
});

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/roster/role">,
) {
  try {
    const { groupId } = await context.params;
    const input = roleSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Choose a valid role." }, { status: 400 });
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data: entry, error: entryError } = await admin
      .from("group_access_roster")
      .select("id, role")
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

    // A group without an owner cannot be administered back into shape, so
    // the last one may not be demoted.
    if (entry.role === "owner" && input.data.role !== "owner") {
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

    const { error } = await admin
      .from("group_access_roster")
      .update({ role: input.data.role })
      .eq("group_id", groupId)
      .eq("id", input.data.rosterEntryId);
    if (error) throw error;

    // Memberships carry their own copy of the role for permission checks.
    const { error: membershipError } = await admin
      .from("group_memberships")
      .update({ role: input.data.role })
      .eq("group_id", groupId)
      .eq("roster_entry_id", input.data.rosterEntryId);
    if (membershipError) throw membershipError;

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
