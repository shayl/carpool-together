import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSuggestions,
  photonSuggestUrl,
} from "./address-suggestions";

test("requests localized, bounded suggestions", () => {
  const url = new URL(
    photonSuggestUrl("ben gurion", { language: "en", bias: "34.2,29.4,35.9,33.4" }),
  );
  assert.equal(url.hostname, "photon.komoot.io");
  assert.equal(url.searchParams.get("q"), "ben gurion");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("bbox"), "34.2,29.4,35.9,33.4");
});

test("skips languages the geocoder rejects, keeping native names", () => {
  // Photon 400s on lang=he; unlocalized results are already in Hebrew.
  const url = new URL(photonSuggestUrl("בן גוריון", { language: "he" }));
  assert.equal(url.searchParams.get("lang"), null);
  assert.equal(url.searchParams.get("q"), "בן גוריון");
});

test("omits optional parameters when unset", () => {
  const url = new URL(photonSuggestUrl("main st"));
  assert.equal(url.searchParams.get("lang"), null);
  assert.equal(url.searchParams.get("bbox"), null);
});

test("builds readable addresses with coordinates", () => {
  const suggestions = normalizeSuggestions({
    features: [
      {
        properties: {
          osm_id: 1,
          osm_type: "W",
          housenumber: "12",
          street: "Ben Gurion",
          city: "Givat Shmuel",
          country: "Israel",
        },
        geometry: { coordinates: [34.8455, 32.0756] },
      },
    ],
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].address, "12 Ben Gurion, Givat Shmuel, Israel");
  assert.equal(suggestions[0].latitude, 32.0756);
  assert.equal(suggestions[0].longitude, 34.8455);
});

test("keeps a venue name but never repeats the street", () => {
  const [venue, road] = normalizeSuggestions({
    features: [
      {
        properties: {
          osm_id: 2,
          name: "Zofim Hall",
          street: "Herzl",
          city: "Tel Aviv",
        },
        geometry: { coordinates: [34.78, 32.08] },
      },
      {
        properties: { osm_id: 3, name: "Herzl", street: "Herzl", city: "Haifa" },
        geometry: { coordinates: [34.99, 32.79] },
      },
    ],
  });

  assert.equal(venue.address, "Zofim Hall, Herzl, Tel Aviv");
  assert.equal(road.address, "Herzl, Haifa");
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
