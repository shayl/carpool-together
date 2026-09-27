import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintGroupPin, generateGroupPin } from "@/lib/group-pin";

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
