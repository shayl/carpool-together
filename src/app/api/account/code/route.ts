import { z } from "zod";
import { requireAccount } from "@/lib/account";
import { accountIdentifierHash, clearFailedLogins } from "@/lib/login-rate-limit";
import {
  hashPersonalCode,
  verifyPersonalCode,
} from "@/lib/personal-code";
import { apiError, requireUserId } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const changeCodeSchema = z.object({
  currentCode: z.string().min(4).max(12),
  // Chosen by the person, so they can pick something memorable. The first
  // code is derived from their phone and has to be replaced before the app
  // will let them in.
  newCode: z.string().regex(/^\d{6}$/, "Choose a new six-digit code."),
});

export async function PATCH(request: Request) {
  try {
    const input = changeCodeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: input.error.issues[0]?.message ?? "Choose a six-digit code." },
        { status: 400 },
      );
    }

    const userId = await requireUserId();
    const admin = createAdminClient();
    const account = await requireAccount(admin, userId);

    const { data: stored, error: storedError } = await admin
      .from("accounts")
      .select("code_hash")
      .eq("id", account.id)
      .single();
    if (storedError) throw storedError;

    if (!(await verifyPersonalCode(input.data.currentCode, stored.code_hash))) {
      return Response.json(
        { error: "That is not your current code." },
        { status: 401 },
      );
    }

    if (input.data.newCode === input.data.currentCode) {
      return Response.json(
        { error: "Choose a code you have not used before." },
        { status: 400 },
      );
    }

    const { error } = await admin
      .from("accounts")
      .update({
        code_hash: await hashPersonalCode(input.data.newCode),
        must_change_code: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
    if (error) throw error;

    // Changing the code proves ownership, so an earlier lockout no longer
    // applies.
    await clearFailedLogins(admin, accountIdentifierHash(account.phone));

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
