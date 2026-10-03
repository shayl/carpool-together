import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const rosterSchema = z.object({
  entries: z
    .array(
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, "Enter the person's name.")
          .max(100, "The name is too long."),
        phone: z
          .string()
          .trim()
          .min(7, "The phone number is too short.")
          .max(30, "The phone number is too long."),
        role: z
          .enum(["admin", "coordinator", "member"])
          .default("member"),
      }),
    )
    .min(1)
    .max(100),
});

async function addRosterEntries(request: Request, groupId: string) {
  const input = rosterSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    // Say exactly which field was rejected; a generic message leaves people
    // guessing which of the two fields is the problem.
    const issue = input.error.issues[0];
    console.error("roster add rejected:", issue.path.join("."), issue.message);
    return Response.json({ error: issue.message }, { status: 400 });
  }

  const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
  const phones = input.data.entries.map((entry) => normalizePhone(entry.phone));

  // Linking the phone to its account is what makes the person land in their
  // own family's household here, instead of a fresh empty one. Someone with
  // no account yet is left unlinked and adopts the household when they first
  // sign in.
  const { data: accounts, error: accountsError } = await admin
    .from("accounts")
    .select("id, phone")
    .in("phone", phones);
  if (accountsError) throw accountsError;

  const accountByPhone = new Map(
    (accounts ?? []).map((account) => [account.phone, account.id]),
  );
  const rows = input.data.entries.map((entry) => {
    const phone = normalizePhone(entry.phone);
    return {
      group_id: groupId,
      account_id: accountByPhone.get(phone) ?? null,
      display_name: entry.displayName,
      phone,
      role: entry.role,
      active: true,
    };
  });
  const { data: saved, error } = await admin
    .from("group_access_roster")
    .upsert(rows, { onConflict: "group_id,phone" })
    .select("id");

  if (error) throw error;

  // Re-adding a removed person restores their roster entry; their membership
  // was suspended when they were removed, so lift that too or their device
  // stays locked out of the group.
  const restoredIds = (saved ?? []).map((entry) => entry.id);
  if (restoredIds.length) {
    const { error: membershipError } = await admin
      .from("group_memberships")
      .update({ status: "active" })
      .eq("group_id", groupId)
      .eq("status", "suspended")
      .in("roster_entry_id", restoredIds);
    if (membershipError) throw membershipError;
  }

  return Response.json({ added: rows.length });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/roster">,
) {
  try {
    const { groupId } = await context.params;
    return await addRosterEntries(request, groupId);
  } catch (error) {
    return apiError(error);
  }
}
