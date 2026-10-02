import assert from "node:assert/strict";
import test from "node:test";
import { availableGroupId, settingsSectionFromParams, teamSectionFromParams } from "./ui-navigation";

test("team task sections restore from URLs, with venue links opening Places", () => {
  for (const section of ["schedule", "people", "places", "balance"]) assert.equal(teamSectionFromParams(new URLSearchParams({ team: section })), section);
  assert.equal(teamSectionFromParams(new URLSearchParams({ venue: "shared" })), "places");
  assert.equal(teamSectionFromParams(new URLSearchParams({ team: "unknown" })), "schedule");
});

test("settings navigation recognizes category pages and rejects unknown pages", () => {
  for (const section of ["preferences", "groups", "management", "about", "help"]) assert.equal(settingsSectionFromParams(new URLSearchParams({ settings: section })), section);
  assert.equal(settingsSectionFromParams(new URLSearchParams({ settings: "unknown" })), null);
});

test("remembered groups are selected only from current memberships", () => {
  assert.equal(availableGroupId(["one", "two"], "two"), "two");
  assert.equal(availableGroupId(["one", "two"], "removed"), "one");
  assert.equal(availableGroupId(["one"], null), "one");
});
