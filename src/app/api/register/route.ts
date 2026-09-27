import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { clientAddress } from "@/lib/client-address";
import { prepareGeneratedGroupPin } from "@/lib/group-pin";
import { normalizePhone } from "@/lib/phone";
import { apiError } from "@/lib/server-auth";
import { toSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const registrationSchema = z.object({
  accessToken: z.string().min(20),
  groupName: z.string().trim().min(2).max(100),
  memberName: z.string().trim().min(1).max(100),
  phone: z.string().min(7).max(30),
});

function registrationIdentifier(request: Request) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required.");

  return createHmac("sha256", secret)
    .update(`group-registration|${clientAddress(request)}`)
    .digest("hex");
}

async function registerGroup(request: Request) {
  const parsed = registrationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Complete every field with valid values." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(
    parsed.data.accessToken,
  );
  if (authError || !authData.user?.is_anonymous) {
    return Response.json({ error: "Invalid device session." }, { status: 401 });
  }

  const baseSlug = toSlug(parsed.data.groupName);
  const slug = `${baseSlug}-${randomBytes(4).toString("hex")}`;
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
    const result = await admin.rpc("register_group_with_generated_pin", {
      auth_user_id: authData.user.id,
      group_name: parsed.data.groupName,
      group_pin_fingerprint: pin.pinFingerprint,
      group_pin_hash: pin.pinHash,
      group_slug: slug,
      member_name: parsed.data.memberName,
      member_phone: normalizePhone(parsed.data.phone),
      registration_identifier_hash: registrationIdentifier(request),
    });
    groupId = result.data;
    error = result.error;
    if (!error) {
      generatedPin = pin.pin;
      break;
    }
    if (error.code !== "23505") break;
  }

  if (error && error.code !== "23505") {
    if (error.message.includes("Registration rate limit exceeded")) {
      return Response.json(
        { error: "Too many groups were created from this network today." },
        { status: 429, headers: { "Retry-After": "86400" } },
      );
    }
    if (error.message.includes("does not already belong")) {
      return Response.json(
        {
          error:
            "This device already belongs to a group. Sign in and create another group from Settings.",
        },
        { status: 409 },
      );
    }
    throw error;
  }

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
    return await registerGroup(request);
  } catch (error) {
    return apiError(error);
  }
}
