import assert from "node:assert/strict";
import test from "node:test";
import { navigationStateFromSearchParams } from "@/lib/navigation-state";

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
