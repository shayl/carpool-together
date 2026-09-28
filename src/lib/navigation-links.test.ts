import assert from "node:assert/strict";
import test from "node:test";
import {
  googleRouteUrl,
  placeUrl,
  savedNavigationProvider,
  singleStopUrl,
} from "./navigation-links";
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

test("opens a single place in each maps provider", () => {
  assert.match(placeUrl("google", stops[1]), /^https:\/\/www\.google\.com/);
  assert.match(placeUrl("apple", stops[1]), /^https:\/\/maps\.apple\.com/);
  assert.match(placeUrl("waze", stops[1]), /^https:\/\/www\.waze\.com/);
  assert.equal(
    new URL(placeUrl("google", stops[1])).searchParams.get("query"),
    "47.2,-122.2",
  );
});

test("falls back to a place address without coordinates", () => {
  const venue: GeoStop = {
    label: "Venue",
    address: "123 Example Street",
    latitude: null,
    longitude: null,
  };

  assert.equal(
    new URL(placeUrl("google", venue)).searchParams.get("query"),
    "123 Example Street",
  );
  assert.match(placeUrl("waze", venue), /q=123%20Example%20Street/);
});

test("defaults unknown saved providers to Google Maps", () => {
  assert.equal(savedNavigationProvider(null), "google");
  assert.equal(savedNavigationProvider("nonsense"), "google");
  assert.equal(savedNavigationProvider("waze"), "waze");
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
