import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prepareGeneratedGroupPin } from "@/lib/group-pin";
import { normalizePhone } from "@/lib/phone";
import { apiError, requireUserId } from "@/lib/server-auth";
import { toSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

async function createGroup(request: Request) {
  const input = createGroupSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a valid group name." },
      { status: 400 },
    );
  }

  const userId = await requireUserId();
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("group_memberships")
    .select("roster_entry_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("roster_entry_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership?.roster_entry_id) {
    return Response.json(
      { error: "Your current membership is not linked to a roster entry." },
      { status: 409 },
    );
  }

  const { data: rosterEntry, error: rosterError } = await admin
    .from("group_access_roster")
    .select("display_name, phone")
    .eq("id", membership.roster_entry_id)
    .single();

  if (rosterError) throw rosterError;

  const baseSlug = toSlug(input.data.name);
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  const { data: legacyGroups, error: legacyGroupsError } = await admin
    .from("groups")
    .select("pin_hash")
    .is("pin_fingerprint", null);
  if (legacyGroupsError) throw legacyGroupsError;
  const legacyPinHashes = (legacyGroups ?? []).map((group) => group.pin_hash);
  let groupId: string | null = null;
  let generatedPin = "";
  let error: { code?: string; message: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pin = await prepareGeneratedGroupPin(legacyPinHashes);
    const result = await admin.rpc(
      "create_additional_group_with_generated_pin",
      {
        auth_user_id: userId,
        group_name: input.data.name,
        group_pin_fingerprint: pin.pinFingerprint,
        group_pin_hash: pin.pinHash,
        group_slug: slug,
        member_name: rosterEntry.display_name,
        member_phone: normalizePhone(rosterEntry.phone),
      },
    );
    groupId = result.data;
    error = result.error;
    if (!error) {
      generatedPin = pin.pin;
      break;
    }
    if (error.code !== "23505") break;
  }

  if (error && error.code !== "23505") throw error;
  if (!groupId || !generatedPin) {
    return Response.json(
      { error: "Could not generate a unique group PIN. Try again." },
      { status: 503 },
    );
  }
  return Response.json({ groupId, pin: generatedPin }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await createGroup(request);
  } catch (error) {
    return apiError(error);
  }
}
