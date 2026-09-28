export type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

export const minimumQueryLength = 3;

// Photon is the autocomplete-oriented OpenStreetMap geocoder. It needs no API
// key, and shares its data with the Nominatim lookup used for routes, so
// suggestions and route geocoding agree.
export function photonSuggestUrl(
  query: string,
  { bias }: { bias?: string } = {},
) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  // Addresses are stored and displayed in English regardless of UI language.
  url.searchParams.set("lang", "en");
  // Bias ranking toward the group's region without excluding other results.
  if (bias) url.searchParams.set("bbox", bias);
  return url.toString();
}

// US-style: "Zofim Hall, 3011 181st Ave NE, Bellevue, WA 98008". State and ZIP
// matter for disambiguation; the country does not, since groups are local.
export function formatSuggestionAddress(
  properties: NonNullable<PhotonFeature["properties"]>,
) {
  const street = [properties.housenumber, properties.street]
    .filter(Boolean)
    .join(" ");
  // `name` duplicates the street for road results, so only keep it when it
  // adds something (a venue or landmark).
  const leading =
    properties.name && properties.name !== properties.street
      ? properties.name
      : "";
  const city = properties.city ?? properties.district;
  const region = [properties.state, properties.postcode]
    .filter(Boolean)
    .join(" ");

  return [leading, street, city, region]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function normalizeSuggestions(payload: unknown): AddressSuggestion[] {
  const features = (payload as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(features)) return [];

  const seen = new Set<string>();
  return features.flatMap((feature, index) => {
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!properties || !coordinates) return [];
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const address = formatSuggestionAddress(properties);
    if (!address || seen.has(address)) return [];
    seen.add(address);

    return [
      {
        id: `${properties.osm_type ?? "x"}${properties.osm_id ?? index}`,
        label: properties.name?.trim() || address,
        address,
        latitude,
        longitude,
      },
    ];
  });
}
