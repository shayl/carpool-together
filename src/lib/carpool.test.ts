import assert from "node:assert/strict";
import test from "node:test";
import type { SuggestionRequest } from "./carpool";
import { suggestCarpools } from "./carpool";

const request: SuggestionRequest = {
  groupId: "group-a",
  destination: { lat: 47.62, lng: -122.32 },
  participants: [
    {
      id: "rider-1",
      groupId: "group-a",
      name: "Rider One",
      address: "North pickup",
      location: { lat: 47.7, lng: -122.33 },
      needsRide: true,
    },
    {
      id: "rider-2",
      groupId: "group-a",
      name: "Rider Two",
      address: "South pickup",
      location: { lat: 47.55, lng: -122.3 },
      needsRide: true,
    },
    {
      id: "other-group",
      groupId: "group-b",
      name: "Private Other Group Rider",
      address: "Hidden pickup",
      location: { lat: 47.61, lng: -122.31 },
      needsRide: true,
    },
  ],
  drivers: [
    {
      id: "driver-1",
      groupId: "group-a",
      name: "Driver One",
      address: "North origin",
      origin: { lat: 47.71, lng: -122.34 },
      seats: 1,
    },
  ],
};

test("never includes participants from another group", () => {
  const plan = suggestCarpools(request);
  const assigned = plan.trips.flatMap((trip) => trip.riderIds);
  const unassigned = plan.unassigned.map((item) => item.participantId);

  assert.equal(assigned.includes("other-group"), false);
  assert.equal(unassigned.includes("other-group"), false);
});

test("respects capacity and explains uncovered riders", () => {
  const plan = suggestCarpools(request);

  assert.equal(plan.trips[0].riderIds.length, 1);
  assert.equal(plan.trips[0].seatsRemaining, 0);
  assert.equal(plan.unassigned.length, 1);
  assert.match(plan.unassigned[0].reason, /remaining seats/i);
});

test("returns deterministic assignments", () => {
  assert.deepEqual(suggestCarpools(request), suggestCarpools(request));
});
