import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { toSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const bootstrapSchema = z.object({
  accessToken: z.string().min(20),
  bootstrapSecret: z.string().min(1),
  groupName: z.string().trim().min(2).max(100),
  memberName: z.string().trim().min(1).max(100),
  phone: z.string().min(7).max(30),
  pin: z.string().min(4).max(12),
});

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  try {
    const parsed = bootstrapSchema.safeParse(await request.json());

    if (!parsed.success) {
      return Response.json(
        { error: "Complete every setup field with valid values." },
        { status: 400 },
      );
    }

    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (
      !expectedSecret ||
      !secretsMatch(parsed.data.bootstrapSecret.trim(), expectedSecret.trim())
    ) {
      return Response.json({ error: "Invalid setup secret." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(
      parsed.data.accessToken,
    );

    if (authError || !authData.user?.is_anonymous) {
      return Response.json(
        { error: "Invalid device session." },
        { status: 401 },
      );
    }

    const slug = toSlug(parsed.data.groupName);
    if (!slug) {
      return Response.json(
        { error: "Group name must contain letters or numbers." },
        { status: 400 },
      );
    }

    const pinHash = await bcrypt.hash(parsed.data.pin, 12);
    const { error } = await admin.rpc("bootstrap_first_group", {
      auth_user_id: authData.user.id,
      group_name: parsed.data.groupName,
      group_pin_hash: pinHash,
      group_slug: slug,
      member_name: parsed.data.memberName,
      member_phone: normalizePhone(parsed.data.phone),
    });

    if (error) {
      if (error.message.includes("already been set up")) {
        return Response.json(
          { error: "The first group has already been set up." },
          { status: 409 },
        );
      }
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not set up the first group." },
      { status: 500 },
    );
  }
}
