import type { SupabaseClient } from "@supabase/supabase-js";
import { membershipsForPhone, type RosterEntry } from "@/lib/group-access";

export type AccountRecord = {
  id: string;
  phone: string;
  family_id: string | null;
  must_change_code: boolean;
  display_name: string | null;
};

// Which account is signed in on this device. Identity used to be readable
// only through a group membership, which meant someone who belonged to no
// group had none; `account_devices` is what makes that answerable.
export async function accountForUser(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("account_devices")
    .select("accounts(id, phone, family_id, must_change_code, display_name)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const account = (data as { accounts: AccountRecord | null } | null)?.accounts;
  return account ?? null;
}

export async function requireAccount(admin: SupabaseClient, userId: string) {
  const account = await accountForUser(admin, userId);
  if (!account) {
    throw Response.json(
      { error: "Sign in again to continue." },
      { status: 401 },
    );
  }
  return account;
}

// An organizer adding a phone to a roster is the only way to join a group, so
// the new group has to start following the account without the member doing
// anything. Reconciling on load is what makes it "just appear".
export async function syncAccountMemberships(
  admin: SupabaseClient,
  userId: string,
) {
  const account = await accountForUser(admin, userId);
  if (!account) return;

  const { data: rosterEntries, error } = await admin
    .from("group_access_roster")
    .select("id, group_id, display_name, role")
    .eq("account_id", account.id)
    .eq("active", true);

  if (error) throw error;
  const entries = (rosterEntries ?? []) as RosterEntry[];
  if (!entries.length) return;

  const { error: membershipError } = await admin
    .from("group_memberships")
    .upsert(membershipsForPhone(entries, userId), {
      onConflict: "group_id,user_id",
    });
  if (membershipError) throw membershipError;
}
