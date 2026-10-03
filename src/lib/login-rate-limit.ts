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

// A personal code is only six digits and is the one thing guarding an
// account, so the phone+IP limit above is not enough on its own: an attacker
// who rotates IPs gets unlimited attempts. This second counter ignores the
// address, at the cost of letting someone deliberately lock a phone they know.
const ACCOUNT_MAX_ATTEMPTS = 10;

export function accountIdentifierHash(phone: string) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required.");

  return createHmac("sha256", secret)
    .update(`account|${normalizePhone(phone)}`)
    .digest("hex");
}

export async function enforceAccountLockout(
  admin: SupabaseClient,
  phone: string,
) {
  const hash = accountIdentifierHash(phone);
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("auth_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identifier_hash", hash)
    .gte("attempted_at", since);

  if (error) throw error;
  if ((count ?? 0) >= ACCOUNT_MAX_ATTEMPTS) {
    throw Response.json(
      {
        error:
          "This account is locked after too many attempts. Try again in 15 minutes.",
      },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  return hash;
}
