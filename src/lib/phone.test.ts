import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhone, phoneLookupValues } from "./phone";

test("normalizes common US phone formats", () => {
  assert.equal(normalizePhone("(425) 555-0100"), "+14255550100");
  assert.equal(normalizePhone("1-425-555-0100"), "+14255550100");
  assert.equal(normalizePhone("+1 425 555 0100"), "+14255550100");
});

test("includes legacy phone storage formats when looking up a US number", () => {
  assert.deepEqual(phoneLookupValues("4255550100"), [
    "+14255550100",
    "14255550100",
    "4255550100",
  ]);
});
