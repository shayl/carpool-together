import assert from "node:assert/strict";
import test from "node:test";
import { mergeGroupSchedules } from "./all-groups-schedule";
import {
  isOwnHousehold,
  participantsInGroup,
  rideState,
} from "./schedule-state";
import type { AppGroup } from "./app-data";
import type { GroupSchedule } from "./schedule-types";

function emptySchedule(): GroupSchedule {
  return {
    households: [],
    participants: [],
    locations: [],
    events: [],
    attendance: [],
    claims: [],
    breaks: [],
    absencePeriods: [],
    templates: [],
    currentHouseholdId: null,
  };
}

function group(id: string, householdId: string, eventId: string): AppGroup {
  return {
    id,
    name: `Group ${id}`,
    shortName: id.toUpperCase(),
    accent: "#5b4bdb",
    role: "member",
    canManageRoster: false,
    currentRosterEntryId: `roster-${id}`,
    currentMemberName: "Sam",
    roster: [],
    schedule: {
      ...emptySchedule(),
      currentHouseholdId: householdId,
      households: [
        {
          id: householdId,
          groupId: id,
          rosterEntryId: `roster-${id}`,
          name: "Morgan",
          memberNames: ["Sam"],
          address: "",
          latitude: null,
          longitude: null,
        },
      ],
      events: [
        {
          id: eventId,
          groupId: id,
          templateId: null,
          date: "2026-10-04",
          startTime: "16:00:00",
          endTime: "17:30:00",
          locationId: `loc-${id}`,
          needsTo: true,
          needsFrom: false,
          eventType: "practice",
          title: null,
          changedAt: null,
        },
      ],
      participants: [
        {
          id: `rider-${id}`,
          groupId: id,
          householdId,
          rosterEntryId: null,
          name: "Rowan",
        },
      ],
      claims: [
        {
          id: `claim-${id}`,
          eventId,
          leg: "to_event",
          householdId,
          driverRosterEntryId: null,
          claimedBy: "user",
        },
      ],
    },
  };
}

test("combines every group's rows into one schedule", () => {
  const merged = mergeGroupSchedules([
    group("a", "household-a", "event-a"),
    group("b", "household-b", "event-b"),
  ]);

  assert.deepEqual(
    merged.events.map((event) => event.id),
    ["event-a", "event-b"],
  );
  assert.equal(merged.households.length, 2);
  assert.equal(merged.claims.length, 2);
});

test("recognises the viewer's household in each group", () => {
  const merged = mergeGroupSchedules([
    group("a", "household-a", "event-a"),
    group("b", "household-b", "event-b"),
  ]);

  // The viewer is a different household in each group, so both count as
  // theirs -- this is what a single currentHouseholdId got wrong.
  assert.equal(isOwnHousehold(merged, "household-a"), true);
  assert.equal(isOwnHousehold(merged, "household-b"), true);
  assert.equal(isOwnHousehold(merged, "household-elsewhere"), false);
  assert.equal(isOwnHousehold(merged, null), false);
});

test("reports a ride in either group as one the viewer drives", () => {
  const groups = [
    group("a", "household-a", "event-a"),
    group("b", "household-b", "event-b"),
  ];
  const merged = mergeGroupSchedules(groups);

  for (const event of merged.events) {
    assert.equal(
      rideState(merged, event, "to_event").mine,
      true,
      `${event.id} should read as the viewer's own ride`,
    );
  }
});

test("keeps single-group behaviour unchanged", () => {
  const single = group("a", "household-a", "event-a").schedule;
  assert.equal(isOwnHousehold(single, "household-a"), true);
  assert.equal(isOwnHousehold(single, "household-b"), false);
});

test("an event only concerns riders from its own group", () => {
  const groups = [
    group("a", "household-a", "event-a"),
    group("b", "household-b", "event-b"),
  ];
  const merged = mergeGroupSchedules(groups);

  // The merged schedule holds every group's riders; showing all of them on
  // one event would overstate who needs a seat.
  assert.equal(merged.participants.length, 2);
  for (const event of merged.events) {
    const riders = participantsInGroup(merged, event);
    assert.deepEqual(
      riders.map((rider) => rider.id),
      [`rider-${event.groupId}`],
    );
  }
});

test("counts only the event's own riders as needing a ride", () => {
  const merged = mergeGroupSchedules([
    group("a", "household-a", "event-a"),
    group("b", "household-b", "event-b"),
  ]);
  const event = merged.events[0];
  assert.equal(rideState(merged, event, "to_event").participants.length, 1);
});
