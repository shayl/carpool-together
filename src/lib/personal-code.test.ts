import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePersonalCode,
  hashPersonalCode,
  initialCodeFromPhone,
  verifyPersonalCode,
} from "./personal-code";

test("derives the first code from the end of the phone number", () => {
  assert.equal(initialCodeFromPhone("+14255398809"), "398809");
  assert.equal(initialCodeFromPhone("+972542341685"), "341685");
  // Formatting must not change the result; the same person may type either.
  assert.equal(initialCodeFromPhone("(425) 539-8809"), "398809");
});

test("pads a phone number shorter than the code length", () => {
  assert.equal(initialCodeFromPhone("12345"), "012345");
});

test("generates six-digit codes, keeping any leading zeros", () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    assert.match(generatePersonalCode(), /^\d{6}$/);
  }
});

test("verifies a code only against its own hash", async () => {
  const hash = await hashPersonalCode("398809");
  assert.equal(await verifyPersonalCode("398809", hash), true);
  assert.equal(await verifyPersonalCode("398800", hash), false);
});

test("never verifies against the migration's placeholder hash", async () => {
  // The migration seeds this sentinel so nobody can sign in before real
  // codes are written.
  assert.equal(await verifyPersonalCode("398809", "pending-seed"), false);
});
