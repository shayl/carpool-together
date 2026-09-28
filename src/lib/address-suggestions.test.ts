import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSuggestions,
  photonSuggestUrl,
} from "./address-suggestions";

test("requests English, region-biased suggestions", () => {
  const url = new URL(
    photonSuggestUrl("181st ave", { bias: "-125.0,24.4,-66.9,49.4" }),
  );
  assert.equal(url.hostname, "photon.komoot.io");
  assert.equal(url.searchParams.get("q"), "181st ave");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("bbox"), "-125.0,24.4,-66.9,49.4");
});

test("omits the region bias when unset", () => {
  const url = new URL(photonSuggestUrl("main st"));
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("bbox"), null);
});

test("builds US-style addresses with coordinates", () => {
  const suggestions = normalizeSuggestions({
    features: [
      {
        properties: {
          osm_id: 1,
          osm_type: "W",
          housenumber: "3011",
          street: "181st Avenue Northeast",
          city: "Bellevue",
          state: "WA",
          postcode: "98008",
          country: "United States",
        },
        geometry: { coordinates: [-122.1, 47.6] },
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(
    suggestions[0].address,
    "3011 181st Avenue Northeast, Bellevue, WA 98008",
  );
  assert.equal(suggestions[0].latitude, 47.6);
  assert.equal(suggestions[0].longitude, -122.1);
});

test("keeps a venue name but never repeats the street", () => {
  const [venue, road] = normalizeSuggestions({
    features: [
      {
        properties: {
          osm_id: 2,
          name: "Crossroads Park",
          street: "164th Ave NE",
          city: "Bellevue",
          state: "WA",
        },
        geometry: { coordinates: [-122.13, 47.61] },
      },
      {
        properties: {
          osm_id: 3,
          name: "Main Street",
          street: "Main Street",
          city: "Redmond",
          state: "WA",
        },
        geometry: { coordinates: [-122.12, 47.67] },
      },
    ],
  });

  assert.equal(venue.address, "Crossroads Park, 164th Ave NE, Bellevue, WA");
  assert.equal(road.address, "Main Street, Redmond, WA");
});

test("drops duplicates and entries without usable coordinates", () => {
  const suggestions = normalizeSuggestions({
    features: [
      {
        properties: { osm_id: 4, street: "Main", city: "Springfield" },
        geometry: { coordinates: [1, 2] },
      },
      {
        properties: { osm_id: 5, street: "Main", city: "Springfield" },
        geometry: { coordinates: [1, 2] },
      },
      { properties: { osm_id: 6, street: "No Geometry", city: "Nowhere" } },
    ],
  });

  assert.equal(suggestions.length, 1);
});

test("returns nothing for malformed payloads", () => {
  assert.deepEqual(normalizeSuggestions(null), []);
  assert.deepEqual(normalizeSuggestions({}), []);
  assert.deepEqual(normalizeSuggestions({ features: "nope" }), []);
});
