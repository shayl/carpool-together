import { createHmac, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

function pinSecret() {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required.");
  return secret;
}

export function generateGroupPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function fingerprintGroupPin(pin: string) {
  return createHmac("sha256", pinSecret())
    .update(`group-pin|${pin}`)
    .digest("hex");
}

export async function prepareGeneratedGroupPin(
  legacyPinHashes: (string | null)[] = [],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pin = generateGroupPin();
    const comparisons = await Promise.all(
      legacyPinHashes
        .filter((hash): hash is string => Boolean(hash))
        .map((hash) => bcrypt.compare(pin, hash)),
    );
    if (comparisons.some(Boolean)) continue;

    return {
      pin,
      pinHash: await bcrypt.hash(pin, 12),
      pinFingerprint: fingerprintGroupPin(pin),
    };
  }

  throw new Error("Could not generate a unique group PIN.");
}
