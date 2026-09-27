import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptGroupPin,
  encryptGroupPin,
  fingerprintGroupPin,
  generateGroupPin,
} from "@/lib/group-pin";

test("generates a six-digit group PIN", () => {
  assert.match(generateGroupPin(), /^\d{6}$/);
});

test("fingerprints group PINs deterministically without exposing them", () => {
  const previousSecret = process.env.AUTH_RATE_LIMIT_SECRET;
  process.env.AUTH_RATE_LIMIT_SECRET = "test-secret";
  try {
    const fingerprint = fingerprintGroupPin("123456");
    assert.equal(fingerprint, fingerprintGroupPin("123456"));
    assert.notEqual(fingerprint, fingerprintGroupPin("654321"));
    assert.equal(fingerprint.includes("123456"), false);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AUTH_RATE_LIMIT_SECRET;
    } else {
      process.env.AUTH_RATE_LIMIT_SECRET = previousSecret;
    }
  }
});

test("encrypts group PINs for authenticated owner retrieval", () => {
  const previousSecret = process.env.GROUP_PIN_ENCRYPTION_SECRET;
  process.env.GROUP_PIN_ENCRYPTION_SECRET = "test-encryption-secret";
  try {
    const encrypted = encryptGroupPin("123456");
    assert.notEqual(encrypted, "123456");
    assert.equal(encrypted.includes("123456"), false);
    assert.equal(decryptGroupPin(encrypted), "123456");
    assert.notEqual(encryptGroupPin("123456"), encrypted);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.GROUP_PIN_ENCRYPTION_SECRET;
    } else {
      process.env.GROUP_PIN_ENCRYPTION_SECRET = previousSecret;
    }
  }
});
