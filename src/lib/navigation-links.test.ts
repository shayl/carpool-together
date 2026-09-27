import assert from "node:assert/strict";
import test from "node:test";
import { googleRouteUrl, singleStopUrl } from "./navigation-links";
import type { GeoStop } from "./route-optimizer";

const stops: GeoStop[] = [
  { label: "Start", address: "A", latitude: 47.1, longitude: -122.1 },
  { label: "Pickup", address: "B", latitude: 47.2, longitude: -122.2 },
  { label: "End", address: "C", latitude: 47.3, longitude: -122.3 },
];

test("builds a complete Google Maps route", () => {
  const url = new URL(googleRouteUrl(stops));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("origin"), "47.1,-122.1");
  assert.equal(url.searchParams.get("waypoints"), "47.2,-122.2");
  assert.equal(url.searchParams.get("destination"), "47.3,-122.3");
});

test("builds Apple Maps and Waze links for one stop", () => {
  assert.match(singleStopUrl("apple", stops[1]), /^https:\/\/maps\.apple\.com/);
  assert.match(singleStopUrl("waze", stops[1]), /^https:\/\/www\.waze\.com/);
});

test("uses a street address when coordinates are unavailable", () => {
  const destination: GeoStop = {
    label: "Destination",
    address: "123 Example Street",
    latitude: null,
    longitude: null,
  };

  assert.match(
    singleStopUrl("apple", destination),
    /daddr=123%20Example%20Street/,
  );
});
