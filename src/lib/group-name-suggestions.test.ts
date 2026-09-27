import assert from "node:assert/strict";
import test from "node:test";
import { nearestGroupSuggestions } from "@/lib/group-name-suggestions";

const groups = [
  { id: "1", name: "Neighborhood Carpool", slug: "neighborhood-carpool-a1" },
  { id: "2", name: "Dance Team", slug: "dance-team-b2" },
  { id: "3", name: "צופים", slug: "group-c3" },
];

test("suggests the nearest group for a misspelled name", () => {
  assert.equal(
    nearestGroupSuggestions("Neigborhood Carpol", groups)[0].id,
    "1",
  );
});

test("matches Unicode names and slug fragments", () => {
  assert.equal(nearestGroupSuggestions("צופימ", groups)[0].id, "3");
  assert.equal(nearestGroupSuggestions("dance-team", groups)[0].id, "2");
});
