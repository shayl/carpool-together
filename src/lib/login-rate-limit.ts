import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAddress } from "@/lib/client-address";
import { normalizePhone } from "@/lib/phone";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function identifierHash(phone: string, request: Request) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required.");

  return createHmac("sha256", secret)
    .update(`${normalizePhone(phone)}|${clientAddress(request)}`)
    .digest("hex");
}

export async function enforceLoginRateLimit(
  admin: SupabaseClient,
  phone: string,
  request: Request,
) {
  const hash = identifierHash(phone, request);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("auth_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identifier_hash", hash)
    .gte("attempted_at", since);

  if (error) throw error;
  if ((count ?? 0) >= MAX_ATTEMPTS) {
    throw Response.json(
      { error: "Too many sign-in attempts. Try again in 15 minutes." },
      {
        status: 429,
        headers: { "Retry-After": "900" },
      },
    );
  }

  return hash;
}

export async function recordFailedLogin(
  admin: SupabaseClient,
  identifierHashValue: string,
) {
  const { error } = await admin
    .from("auth_login_attempts")
    .insert({ identifier_hash: identifierHashValue });
  if (error) throw error;
}

export async function clearFailedLogins(
  admin: SupabaseClient,
  identifierHashValue: string,
) {
  const { error } = await admin
    .from("auth_login_attempts")
    .delete()
    .eq("identifier_hash", identifierHashValue);
  if (error) throw error;
}
