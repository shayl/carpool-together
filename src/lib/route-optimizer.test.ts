import assert from "node:assert/strict";
import test from "node:test";
import { optimizeStops, type GeoStop } from "./route-optimizer";

const stop = (
  label: string,
  latitude: number,
  longitude: number,
): GeoStop => ({ label, address: label, latitude, longitude });

test("orders stops efficiently while preserving route endpoints", () => {
  const venue = stop("Venue", 47.6, -122.2);
  const nearVenue = stop("Near venue", 47.61, -122.2);
  const nearDriver = stop("Near driver", 47.68, -122.2);
  const driver = stop("Driver home", 47.7, -122.2);

  assert.deepEqual(
    optimizeStops(venue, [nearDriver, nearVenue], driver).map(
      (item) => item.label,
    ),
    ["Venue", "Near venue", "Near driver", "Driver home"],
  );
});

test("uses a bounded deterministic order for large carpools", () => {
  const intermediates = Array.from({ length: 9 }, (_, index) =>
    stop(`Stop ${index}`, 47.61 + index * 0.01, -122.2),
  ).reverse();
  const route = optimizeStops(
    stop("Start", 47.6, -122.2),
    intermediates,
    stop("End", 47.8, -122.2),
  );

  assert.equal(route[0].label, "Start");
  assert.equal(route.at(-1)?.label, "End");
  assert.deepEqual(
    route.slice(1, -1).map((item) => item.label),
    Array.from({ length: 9 }, (_, index) => `Stop ${index}`),
  );
});
