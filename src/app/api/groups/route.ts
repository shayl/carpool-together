import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAccount } from "@/lib/account";
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
  const account = await requireAccount(admin, userId);

  if (!account.family_id) {
    return Response.json(
      { error: "Add your family details before creating a group." },
      { status: 409 },
    );
  }

  const slug = `${toSlug(input.data.name)}-${randomBytes(3).toString("hex")}`;
  const { data: groupId, error } = await admin.rpc(
    "create_group_for_account",
    {
      group_name: input.data.name,
      group_slug: slug,
      auth_user_id: userId,
      account_id: account.id,
    },
  );

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
