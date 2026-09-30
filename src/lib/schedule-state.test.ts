import assert from "node:assert/strict";
import test from "node:test";
import {
  driveCounts,
  effectiveAttendance,
  eventCoverage,
  eventDrivers,
  rideState,
} from "./schedule-state";
import type { GroupSchedule } from "./schedule-types";

const schedule: GroupSchedule = {
  households: [
    {
      id: "h1",
      groupId: "g1",
      rosterEntryId: "r1",
      name: "Alef",
      memberNames: ["Alef"],
      address: "",
      latitude: null,
      longitude: null,
    },
    {
      id: "h2",
      groupId: "g1",
      rosterEntryId: "r2",
      name: "Bet",
      memberNames: ["Bet"],
      address: "",
      latitude: null,
      longitude: null,
    },
  ],
  participants: [
    {
      id: "p1",
      groupId: "g1",
      householdId: "h1",
      rosterEntryId: "r1",
      name: "Alef",
    },
    {
      id: "p2",
      groupId: "g1",
      householdId: "h2",
      rosterEntryId: "r2",
      name: "Bet",
    },
  ],
  locations: [],
  events: [
    {
      id: "e1",
      groupId: "g1",
      templateId: null,
      date: "2026-10-01",
      startTime: "17:00",
      endTime: "18:00",
      locationId: "l1",
      needsTo: true,
      needsFrom: true,
      eventType: "practice",
      title: null,
      changedAt: null,
    },
  ],
  attendance: [],
  claims: [
    {
      id: "c1",
      eventId: "e1",
      leg: "to_event",
      householdId: "h1",
      driverRosterEntryId: null,
      claimedBy: "u1",
    },
  ],
  breaks: [],
  absencePeriods: [],
  templates: [],
  currentHouseholdId: "h1",
};

test("calculates active claims and drive counts", () => {
  const event = schedule.events[0];
  assert.equal(rideState(schedule, event, "to_event").mine, true);
  assert.equal(eventCoverage(schedule, event), "open");
  assert.equal(driveCounts(schedule)[1].count, 1);
});

test("absence periods suppress rides unless a newer daily choice exists", () => {
  const event = schedule.events[0];
  const participant = schedule.participants[0];
  const absentSchedule = {
    ...schedule,
    absencePeriods: [
      {
        id: "a1",
        periodGroupId: "ag1",
        groupId: "g1",
        participantId: participant.id,
        startsOn: event.date,
        endsOn: event.date,
        createdAt: "2026-09-01T00:00:00Z",
      },
    ],
  };
  assert.equal(
    effectiveAttendance(absentSchedule, event, participant).absent,
    true,
  );
});

test("names the driving households once per event", () => {
  const event = schedule.events[0];
  // Only the outbound leg is claimed, so only that household is named.
  assert.deepEqual(eventDrivers(schedule, event), ["Alef"]);

  // A household covering both directions is still named once.
  const bothLegs: GroupSchedule = {
    ...schedule,
    claims: [
      ...schedule.claims,
      {
        id: "c2",
        eventId: "e1",
        leg: "from_event",
        householdId: "h1",
        driverRosterEntryId: null,
        claimedBy: "u1",
      },
    ],
  };
  assert.deepEqual(eventDrivers(bothLegs, event), ["Alef"]);

  // Two households splitting the directions are both named.
  const split: GroupSchedule = {
    ...schedule,
    claims: [
      ...schedule.claims,
      {
        id: "c3",
        eventId: "e1",
        leg: "from_event",
        householdId: "h2",
        driverRosterEntryId: null,
        claimedBy: "u1",
      },
    ],
  };
  assert.deepEqual(eventDrivers(split, event), ["Alef", "Bet"]);
});

test("names nobody when an event has no claims", () => {
  const unclaimed: GroupSchedule = { ...schedule, claims: [] };
  assert.deepEqual(eventDrivers(unclaimed, schedule.events[0]), []);
});
