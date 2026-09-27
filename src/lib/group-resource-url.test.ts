import assert from "node:assert/strict";
import test from "node:test";
import {
  groupResourceUrl,
  type GroupScheduleResource,
} from "@/lib/group-resource-url";

test("schedule mutations target deployed group API routes", () => {
  const resources: GroupScheduleResource[] = [
    "absences",
    "attendance",
    "breaks",
    "claims",
    "events",
    "households",
    "locations",
    "templates",
  ];

  assert.deepEqual(
    resources.map((resource) => groupResourceUrl("group-id", resource)),
    resources.map((resource) => `/api/groups/group-id/${resource}`),
  );
});
