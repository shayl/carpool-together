import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION } from "@/lib/app-version";

test("exposes the package version as a semantic app version", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});
