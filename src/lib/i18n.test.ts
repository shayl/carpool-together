import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "./i18n";

test("returns Hebrew translations and interpolates values", () => {
  assert.equal(translate("he", "Rides"), "נסיעות");
  assert.equal(
    translate("he", "{{count}} people", { count: 4 }),
    "4 אנשים",
  );
});

test("keeps English and unknown dynamic content unchanged", () => {
  assert.equal(translate("en", "Rides"), "Rides");
  assert.equal(translate("he", "Dancers"), "Dancers");
});
