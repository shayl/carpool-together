import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "node:crypto";
import bcrypt from "bcryptjs";

function pinSecret() {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required.");
  return secret;
}

function encryptionKey() {
  const secret = process.env.GROUP_PIN_ENCRYPTION_SECRET;
  if (!secret) throw new Error("GROUP_PIN_ENCRYPTION_SECRET is required.");
  return createHash("sha256").update(secret).digest();
}

export function generateGroupPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function fingerprintGroupPin(pin: string) {
  return createHmac("sha256", pinSecret())
    .update(`group-pin|${pin}`)
    .digest("hex");
}

export function encryptGroupPin(pin: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(pin, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptGroupPin(value: string) {
  const [ivValue, tagValue, ciphertextValue, ...extra] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue || extra.length) {
    throw new Error("Invalid encrypted group PIN.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
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
      pinCiphertext: encryptGroupPin(pin),
    };
  }

  throw new Error("Could not generate a unique group PIN.");
}
