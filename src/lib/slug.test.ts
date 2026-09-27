import assert from "node:assert/strict";
import test from "node:test";
import { toSlug } from "./slug";

test("creates a stable group slug", () => {
  assert.equal(toSlug("Rainier Swim Club"), "rainier-swim-club");
  assert.equal(toSlug("  École Carpool!  "), "ecole-carpool");
});
