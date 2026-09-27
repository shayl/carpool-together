import { z } from "zod";
import {
  matchingRosterEntries,
  membershipsForPhone,
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

  const { accessToken, phone, pin } = parsed.data;
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
  const matches = await matchingRosterEntries(entries, pinHashes, pin);

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
      membershipsForPhone(entries, authData.user.id),
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

  await clearFailedLogins(admin, rateLimitHash);
  return Response.json({
    ok: true,
    groupId: match.group_id,
    linkedGroupCount: entries.length,
  });
}

export async function POST(request: Request) {
  try {
    return await handleLogin(request);
  } catch (error) {
    return apiError(error);
  }
}
