import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewGroups } from "./preview-data";
import { eligibleCurrentDriver, matchesRideFilter, namedRideDriver, nextUpcomingEvent, sortedEvents, weekEventsForDisplay } from "./schedule-ui";
import { eventCoverage, rideState } from "./schedule-state";

const group = createPreviewGroups(new Date(2026, 9, 2, 11))[0];

test("quick volunteering selects exactly the current eligible adult, never the first family adult", () => {
  assert.equal(group.roster[0].id, "alex");
  assert.equal(eligibleCurrentDriver(group.roster, group.currentRosterEntryId)?.id, "sam");
  assert.equal(eligibleCurrentDriver(group.roster, null), undefined);
  assert.equal(eligibleCurrentDriver(group.roster, "unknown"), undefined);
  assert.equal(eligibleCurrentDriver(group.roster.map((member) => ({ ...member, active: false })), "sam"), undefined);
  assert.equal(eligibleCurrentDriver(group.roster.map((member) => ({ ...member, householdId: null })), "sam"), undefined);
});

test("covered outbound and open return remain independent, including filters and named drivers", () => {
  const event = group.schedule.events[0];
  assert.equal(namedRideDriver(group.schedule, group.roster, event, "to_event"), "Sam Morgan");
  assert.equal(namedRideDriver(group.schedule, group.roster, event, "from_event"), undefined);
  assert.equal(matchesRideFilter(group.schedule, event, "mine"), true);
  assert.equal(matchesRideFilter(group.schedule, event, "open"), true);
  assert.equal(rideState(group.schedule, event, "from_event").open, true);
  assert.equal(matchesRideFilter(group.schedule, group.schedule.events[1], "mine"), false);
});

test("collapsed coverage car is happy only when every active direction is covered", () => {
  const event = group.schedule.events[0];
  assert.equal(eventCoverage(group.schedule, event), "open");
  const covered = {
    ...group.schedule,
    claims: [...group.schedule.claims, {
      id: "return-claim", eventId: event.id, leg: "from_event" as const,
      householdId: "morgan", driverRosterEntryId: "sam", claimedBy: "demo",
    }],
  };
  assert.equal(eventCoverage(covered, event), "covered");
  assert.equal(eventCoverage(group.schedule, { ...event, needsFrom: false }), "covered");
  assert.equal(eventCoverage(covered, { ...event, needsTo: false, needsFrom: false }), "neutral");
  const absent = {
    ...covered,
    attendance: covered.participants.map((participant) => ({
      eventId: event.id, participantId: participant.id, absent: true,
      optOutTo: false, optOutFrom: false, updatedAt: "2026-10-02T12:00:00Z",
    })),
  };
  assert.equal(eventCoverage(absent, event), "neutral");
});

test("we're driving excludes a rider-only family and inactive claims", () => {
  const event = group.schedule.events[0];
  const schedule = { ...group.schedule, currentHouseholdId: "rivera" };
  assert.equal(matchesRideFilter(schedule, event, "mine"), false);
  schedule.breaks = [{ id: "break", groupId: group.id, startsOn: event.date, endsOn: event.date, label: null }];
  assert.equal(matchesRideFilter(schedule, event, "open"), false);
});

test("next-up sorts dates and times, ignores breaks and past events, and includes ongoing events", () => {
  const events = [...group.schedule.events].reverse();
  const schedule = { ...group.schedule, events };
  assert.equal(sortedEvents(events)[0].id, "demo-event-0");
  assert.equal(events[0].id, "demo-event-2");
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 2, 17, 30))?.id, "demo-event-1");
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 2, 19))?.id, "demo-event-2");
  schedule.breaks = [{ id: "break", groupId: group.id, startsOn: "2026-09-28", endsOn: "2026-10-04", label: null }];
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 2, 11))?.id, "demo-event-2");
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 4, 11)), undefined);
});

test("current week leads with upcoming events and keeps past events in Earlier this week", () => {
  const result = weekEventsForDisplay(group.schedule.events, "2026-09-28", new Date(2026, 9, 2, 11));
  assert.equal(result.currentWeek, true);
  assert.deepEqual(result.primary.map((event) => event.id), ["demo-event-1", "demo-event-2"]);
  assert.deepEqual(result.earlier.map((event) => event.id), ["demo-event-0"]);
  assert.equal(result.primary.length + result.earlier.length, group.schedule.events.length);
});

test("noncurrent weeks stay chronological, and current filters retain every matching upcoming event", () => {
  const historic = weekEventsForDisplay(group.schedule.events, "2026-09-28", new Date(2026, 9, 12));
  assert.equal(historic.currentWeek, false);
  assert.deepEqual(historic.primary.map((event) => event.id), ["demo-event-0", "demo-event-1", "demo-event-2"]);
  assert.deepEqual(historic.earlier, []);
  const open = group.schedule.events.filter((event) => matchesRideFilter(group.schedule, event, "open"));
  const current = weekEventsForDisplay(open, "2026-09-28", new Date(2026, 9, 2, 11));
  assert.deepEqual(current.primary.map((event) => event.id), ["demo-event-1", "demo-event-2"]);
});

test("today's ongoing event remains above history until its end time", () => {
  assert.equal(weekEventsForDisplay(group.schedule.events, "2026-09-28", new Date(2026, 9, 2, 18, 29)).primary[0].id, "demo-event-1");
  assert.equal(weekEventsForDisplay(group.schedule.events, "2026-09-28", new Date(2026, 9, 2, 18, 30)).primary[0].id, "demo-event-2");
});

test("events without an end time leave Next up once their start time arrives", () => {
  const schedule = { ...group.schedule, events: group.schedule.events.map((event) => ({ ...event, endTime: null })) };
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 2, 16, 59))?.id, "demo-event-1");
  assert.equal(nextUpcomingEvent(schedule, new Date(2026, 9, 2, 17))?.id, "demo-event-2");
});
