import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { apiError, requireUserId } from "@/lib/server-auth";
import { toSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pin: z.string().min(4).max(12),
});

async function createGroup(request: Request) {
  const input = createGroupSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a group name and a PIN with 4 to 12 characters." },
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
  const pinHash = await bcrypt.hash(input.data.pin, 12);
  const { data: groupId, error } = await admin.rpc("create_additional_group", {
    auth_user_id: userId,
    group_name: input.data.name,
    group_pin_hash: pinHash,
    group_slug: slug,
    member_name: rosterEntry.display_name,
    member_phone: normalizePhone(rosterEntry.phone),
  });

  if (error) throw error;
  return Response.json({ groupId }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await createGroup(request);
  } catch (error) {
    return apiError(error);
  }
}
