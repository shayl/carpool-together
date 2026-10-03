import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hashPersonalCode, initialCodeFromPhone } from "@/lib/personal-code";
import { normalizePhone } from "@/lib/phone";
import { toSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

const bootstrapSchema = z.object({
  accessToken: z.string().min(20),
  bootstrapSecret: z.string().min(1),
  groupName: z.string().trim().min(2).max(100),
  memberName: z.string().trim().min(1).max(100),
  phone: z.string().min(7).max(30),
});

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

// The cold-start path for an empty database: there is no organizer to add the
// first person, so this creates their account and their first group in one
// step. Everyone after them is added to a roster instead.
export async function POST(request: Request) {
  try {
    const parsed = bootstrapSchema.safeParse(
      await request.json().catch(() => null),
    );

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

    const { count, error: countError } = await admin
      .from("groups")
      .select("id", { count: "exact", head: true });
    if (countError) throw countError;
    if (count) {
      return Response.json(
        { error: "The first group has already been set up." },
        { status: 409 },
      );
    }

    const phone = normalizePhone(parsed.data.phone);
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({
        phone,
        display_name: parsed.data.memberName,
        code_hash: await hashPersonalCode(initialCodeFromPhone(phone)),
        must_change_code: true,
      })
      .select("id")
      .single();
    if (accountError) throw accountError;

    const { data: groupId, error } = await admin.rpc(
      "create_group_for_account",
      {
        account_id: account.id,
        auth_user_id: authData.user.id,
        group_name: parsed.data.groupName,
        group_slug: toSlug(parsed.data.groupName),
      },
    );
    if (error) throw error;

    return Response.json({ ok: true, groupId });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not set up the first group." },
      { status: 500 },
    );
  }
}
