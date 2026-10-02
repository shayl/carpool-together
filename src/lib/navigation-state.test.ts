import assert from "node:assert/strict";
import test from "node:test";
import { calendarCursorDate, navigationStateFromSearchParams } from "@/lib/navigation-state";

test("creates a complete navigation snapshot from the URL", () => {
  const params = new URLSearchParams({
    tab: "team",
    view: "month",
    date: "2026-10-12",
    venue: "shared-venue",
  });

  assert.deepEqual(
    navigationStateFromSearchParams(
      params,
      new Date("2026-09-30T12:00:00Z"),
    ),
    {
      destination: "team",
      calendarDisplay: "month",
      calendarDate: "2026-10-12",
      currentDate: "2026-09-30",
      venueToken: "shared-venue",
    },
  );
});

test("uses deterministic defaults for invalid URL state", () => {
  const params = new URLSearchParams({
    tab: "unknown",
    view: "agenda",
    date: "not-a-date",
  });

  assert.deepEqual(
    navigationStateFromSearchParams(params, new Date("2026-09-30T12:00:00Z")),
    {
      destination: "rides",
      calendarDisplay: "week",
      calendarDate: "2026-09-28",
      currentDate: "2026-09-30",
      venueToken: "",
    },
  );
});

test("impossible calendar dates fall back instead of creating an invalid cursor", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-00-12"]) {
    assert.equal(navigationStateFromSearchParams(new URLSearchParams({ date }), new Date(2026, 9, 2)).calendarDate, "2026-09-28");
  }
});

test("week cursors normalize across month and year boundaries without changing month cursors", () => {
  assert.equal(calendarCursorDate("2026-10-01", "week"), "2026-09-28");
  assert.equal(calendarCursorDate("2027-01-01", "week"), "2026-12-28");
  assert.equal(calendarCursorDate("2026-10-01", "month"), "2026-10-01");
});
