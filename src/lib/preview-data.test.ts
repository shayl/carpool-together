import assert from "node:assert/strict";
import test from "node:test";
import { applyPreviewRequest, createPreviewGroups, previewEnabled } from "./preview-data";
import { effectiveAttendance, rideState } from "./schedule-state";

test("preview is allowed only in development, never production or test", () => {
  assert.equal(previewEnabled("development"), true);
  for (const environment of ["production", "test", undefined, "staging"]) assert.equal(previewEnabled(environment), false);
});

test("isolated sample claims record the exact named driver without mutating fixtures", () => {
  const group = createPreviewGroups(new Date(2026, 9, 2))[0];
  const input = { eventId: group.schedule.events[0].id, leg: "from_event", driverRosterEntryId: "sam" };
  const updated = applyPreviewRequest(group, "claims", "POST", input);
  const claim = updated.schedule.claims.find((item) => item.leg === "from_event");
  assert.equal(claim?.driverRosterEntryId, "sam");
  assert.equal(claim?.householdId, "morgan");
  assert.equal(group.schedule.claims.length, 2);
  assert.throws(() => applyPreviewRequest(updated, "claims", "POST", input), /already been claimed/);
  assert.throws(() => applyPreviewRequest(group, "claims", "POST", { ...input, driverRosterEntryId: "unknown" }), /not available/);
  assert.equal(applyPreviewRequest(updated, "claims", "DELETE", input).schedule.claims.length, 2);
});

test("all attendance and independent outbound/return combinations round-trip through sample state", () => {
  let group = createPreviewGroups(new Date(2026, 9, 2))[0];
  const event = group.schedule.events[0];
  const participant = group.schedule.participants[0];
  for (const absent of [true, false]) {
    for (const optOutTo of [true, false]) {
      for (const optOutFrom of [true, false]) {
        group = applyPreviewRequest(group, "attendance", "PUT", { eventId: event.id, participantId: participant.id, absent, optOutTo, optOutFrom });
        const attendance = effectiveAttendance(group.schedule, event, participant);
        assert.equal(attendance.absent, absent);
        assert.equal(attendance.optOutTo, optOutTo);
        assert.equal(attendance.optOutFrom, optOutFrom);
        assert.equal(rideState(group.schedule, event, "to_event").participants.some((item) => item.id === participant.id), !absent && !optOutTo);
        assert.equal(rideState(group.schedule, event, "from_event").participants.some((item) => item.id === participant.id), !absent && !optOutFrom);
      }
    }
  }
});

test("sample adapter rejects backend-only resources and cross-group records", () => {
  const group = createPreviewGroups(new Date())[0];
  assert.throws(() => applyPreviewRequest(group, "roster", "POST", {}), /disabled/);
  assert.throws(() => applyPreviewRequest(group, "attendance", "PUT", { eventId: "foreign", participantId: "riley", absent: false, optOutTo: false, optOutFrom: false }), /not found/);
});
