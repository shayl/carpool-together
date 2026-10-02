import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { APP_VERSION } from "@/lib/app-version";

test("exposes the package version as a semantic app version", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test("package lock and root package expose the same app version", () => {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  assert.equal(lock.version, APP_VERSION);
  assert.equal(lock.packages[""].version, APP_VERSION);
});
