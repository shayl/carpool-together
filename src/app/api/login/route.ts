import { z } from "zod";
import { membershipsForPhone, type RosterEntry } from "@/lib/group-access";
import {
  clearFailedLogins,
  enforceAccountLockout,
  enforceLoginRateLimit,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import { verifyPersonalCode } from "@/lib/personal-code";
import { phoneLookupValues } from "@/lib/phone";
import { apiError } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  phone: z.string().min(7).max(30),
  code: z.string().min(4).max(12),
  accessToken: z.string().min(20),
});

async function handleLogin(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid phone number and personal code." },
      { status: 400 },
    );
  }

  const { accessToken, phone, code } = parsed.data;
  const admin = createAdminClient();
  const { data: authData, error: authError } =
    await admin.auth.getUser(accessToken);

  if (authError || !authData.user?.is_anonymous) {
    return Response.json({ error: "Invalid device session." }, { status: 401 });
  }

  const rateLimitHash = await enforceLoginRateLimit(admin, phone, request);
  const accountHash = await enforceAccountLockout(admin, phone);

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id, phone, code_hash, must_change_code, display_name")
    .in("phone", phoneLookupValues(phone))
    .maybeSingle();

  if (accountError) {
    console.error(accountError);
    return Response.json({ error: "Could not sign in." }, { status: 500 });
  }

  // One message whether the phone is unknown or the code is wrong, so this
  // cannot be used to discover which numbers have accounts.
  if (!account || !(await verifyPersonalCode(code, account.code_hash))) {
    await Promise.all([
      recordFailedLogin(admin, rateLimitHash),
      recordFailedLogin(admin, accountHash),
    ]);
    return Response.json(
      { error: "Phone number or personal code is incorrect." },
      { status: 401 },
    );
  }

  const { error: deviceError } = await admin
    .from("account_devices")
    .upsert(
      { account_id: account.id, user_id: authData.user.id },
      { onConflict: "account_id,user_id" },
    );

  if (deviceError) {
    console.error(deviceError);
    return Response.json(
      { error: "Could not link this device to your account." },
      { status: 500 },
    );
  }

  // Claim roster rows an organizer added before this account existed, so the
  // groups they were added to start following the account.
  const { error: claimError } = await admin
    .from("group_access_roster")
    .update({ account_id: account.id })
    .is("account_id", null)
    .in("phone", phoneLookupValues(phone));

  if (claimError) {
    console.error(claimError);
    return Response.json({ error: "Could not sign in." }, { status: 500 });
  }

  const { data: rosterEntries, error: rosterError } = await admin
    .from("group_access_roster")
    .select("id, group_id, display_name, role")
    .eq("account_id", account.id)
    .eq("active", true);

  if (rosterError) {
    console.error(rosterError);
    return Response.json(
      { error: "Could not check group access." },
      { status: 500 },
    );
  }

  const entries = (rosterEntries ?? []) as RosterEntry[];

  if (entries.length) {
    const { error: membershipError } = await admin
      .from("group_memberships")
      .upsert(membershipsForPhone(entries, authData.user.id), {
        onConflict: "group_id,user_id",
      });

    if (membershipError) {
      console.error(membershipError);
      return Response.json(
        { error: "Could not link this device to your groups." },
        { status: 500 },
      );
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ display_name: account.display_name ?? entries[0]?.display_name })
    .eq("user_id", authData.user.id);

  if (profileError) {
    console.error(profileError);
    return Response.json(
      { error: "Could not finish setting up this device." },
      { status: 500 },
    );
  }

  await Promise.all([
    clearFailedLogins(admin, rateLimitHash),
    clearFailedLogins(admin, accountHash),
  ]);

  return Response.json({
    ok: true,
    accountId: account.id,
    mustChangeCode: account.must_change_code,
    groupCount: entries.length,
  });
}

export async function POST(request: Request) {
  try {
    return await handleLogin(request);
  } catch (error) {
    return apiError(error);
  }
}
