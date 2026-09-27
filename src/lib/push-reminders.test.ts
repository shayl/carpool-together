import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReminderLead,
  pickupTime,
  reminderIsDue,
} from "./push-reminders";

test("calculates reminder pickup times in the group timezone", () => {
  assert.equal(
    pickupTime(
      "2026-09-27",
      "17:30",
      "19:00",
      "to_event",
      "America/Los_Angeles",
    )?.toISOString(),
    "2026-09-28T00:30:00.000Z",
  );
  assert.equal(
    pickupTime(
      "2026-09-27",
      "17:30",
      "19:00",
      "from_event",
      "America/Los_Angeles",
    )?.toISOString(),
    "2026-09-28T02:00:00.000Z",
  );
});

test("sends reminders after the lead time and before pickup", () => {
  const pickup = new Date("2026-09-28T00:30:00.000Z");
  assert.equal(
    reminderIsDue(pickup, new Date("2026-09-27T23:30:00.000Z"), 60),
    true,
  );
  assert.equal(
    reminderIsDue(pickup, new Date("2026-09-27T23:29:59.000Z"), 60),
    false,
  );
  assert.equal(reminderIsDue(pickup, pickup, 60), false);
});

test("formats every supported reminder lead", () => {
  assert.deepEqual(
    [15, 30, 60, 90, 120].map((minutes) =>
      formatReminderLead(minutes as 15 | 30 | 60 | 90 | 120),
    ),
    ["15 minutes", "30 minutes", "1 hour", "1 hour 30 minutes", "2 hours"],
  );
});
