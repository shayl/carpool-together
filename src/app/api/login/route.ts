import { z } from "zod";
import {
  matchingRosterEntries,
  type RosterEntry,
} from "@/lib/group-access";
import {
  clearFailedLogins,
  enforceLoginRateLimit,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import { phoneLookupValues } from "@/lib/phone";
import { apiError } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  phone: z.string().min(7).max(30),
  pin: z.string().min(4).max(12),
  accessToken: z.string().min(20),
  targetGroupId: z.string().uuid().optional(),
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
      { error: "Enter a valid phone number and group PIN." },
      { status: 400 },
    );
  }

  const { accessToken, phone, pin, targetGroupId } = parsed.data;
  const admin = createAdminClient();
  const { data: authData, error: authError } =
    await admin.auth.getUser(accessToken);

  if (authError || !authData.user?.is_anonymous) {
    return Response.json({ error: "Invalid device session." }, { status: 401 });
  }

  const rateLimitHash = await enforceLoginRateLimit(admin, phone, request);
  const { data: rosterEntries, error: rosterError } = await admin
    .from("group_access_roster")
    .select("id, group_id, display_name, role")
    .in("phone", phoneLookupValues(phone))
    .eq("active", true)
    .limit(20);

  if (rosterError) {
    console.error(rosterError);
    return Response.json(
      { error: "Could not check group access." },
      { status: 500 },
    );
  }

  const entries = (rosterEntries ?? []) as RosterEntry[];
  const groupIds = [...new Set(entries.map((entry) => entry.group_id))];
  const { data: groups, error: groupsError } = groupIds.length
    ? await admin.from("groups").select("id, name, pin_hash").in("id", groupIds)
    : { data: [], error: null };

  if (groupsError) {
    console.error(groupsError);
    return Response.json(
      { error: "Could not check group access." },
      { status: 500 },
    );
  }

  const pinHashes = new Map<string, string | null>(
    (groups ?? []).map((group) => [
      group.id as string,
      group.pin_hash as string | null,
    ]),
  );
  const loginEntries = targetGroupId
    ? entries.filter((entry) => entry.group_id === targetGroupId)
    : entries;
  const matches = await matchingRosterEntries(loginEntries, pinHashes, pin);

  if (matches.length === 0) {
    await recordFailedLogin(admin, rateLimitHash);
    return Response.json(
      { error: "Phone number or group PIN is incorrect." },
      { status: 401 },
    );
  }

  if (matches.length > 1) {
    return Response.json(
      {
        error:
          "This phone and PIN match more than one group. Ask an organizer to use a different group PIN.",
      },
      { status: 409 },
    );
  }

  const match = matches[0];
  const { error: membershipError } = await admin
    .from("group_memberships")
    .upsert(
      {
        group_id: match.group_id,
        user_id: authData.user.id,
        roster_entry_id: match.id,
        role: match.role,
        status: "active",
      },
      { onConflict: "group_id,user_id" },
    );

  if (membershipError) {
    console.error(membershipError);
    return Response.json(
      { error: "Could not link this device to the group." },
      { status: 500 },
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ display_name: match.display_name })
    .eq("user_id", authData.user.id);

  if (profileError) {
    console.error(profileError);
    return Response.json(
      { error: "Could not finish setting up this device." },
      { status: 500 },
    );
  }

  const { data: verifiedMemberships, error: verifiedMembershipsError } =
    await admin
      .from("group_memberships")
      .select("group_id")
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .in("group_id", groupIds);
  if (verifiedMembershipsError) throw verifiedMembershipsError;

  const verifiedGroupIds = new Set(
    (verifiedMemberships ?? []).map((membership) => membership.group_id),
  );
  const unverifiedGroups = (groups ?? [])
    .filter((group) => !verifiedGroupIds.has(group.id))
    .map((group) => ({ id: group.id, name: group.name }));

  await clearFailedLogins(admin, rateLimitHash);
  return Response.json({
    ok: true,
    groupId: match.group_id,
    unverifiedGroups,
  });
}

export async function POST(request: Request) {
  try {
    return await handleLogin(request);
  } catch (error) {
    return apiError(error);
  }
}
