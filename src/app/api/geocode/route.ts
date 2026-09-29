import { z } from "zod";

const coordinateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const addressSchema = z.object({
  address: z.string().trim().min(5).max(300),
});

const headers = {
  "User-Agent": "CarpoolTogether/1.0",
  Accept: "application/json",
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  error?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const address = params.get("address");
    const endpoint = address
      ? buildSearchUrl(addressSchema.parse({ address }).address)
      : buildReverseUrl(
          coordinateSchema.parse({
            lat: params.get("lat"),
            lng: params.get("lng"),
          }),
        );
    const response = await fetch(endpoint, {
      headers,
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return Response.json(
        { error: "The map service could not resolve this location." },
        { status: 502 },
      );
    }

    const body = (await response.json()) as
      | NominatimResult[]
      | NominatimResult;
    const result = Array.isArray(body) ? body[0] : body;
    if (!result || result.error) {
      return Response.json(
        { error: "No street address was found at that location." },
        { status: 404 },
      );
    }

    return Response.json({
      latitude: Number(result.lat),
      longitude: Number(result.lon),
      address: normalizeAddress(result),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid map location." }, { status: 400 });
    }
    console.error("Geocoding failed", error);
    return Response.json(
      { error: "The map service is temporarily unavailable." },
      { status: 502 },
    );
  }
}

function buildSearchUrl(address: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "us",
    addressdetails: "1",
  }).toString();
  return url;
}

function buildReverseUrl({ lat, lng }: { lat: number; lng: number }) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
  }).toString();
  return url;
}

function normalizeAddress(result: NominatimResult) {
  const address = result.address;
  if (!address) return result.display_name ?? "";
  const streetName = address.road ?? address.pedestrian;
  const street = [address.house_number, streetName].filter(Boolean).join(" ");
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality;
  const cityStateZip = [
    city,
    [address.state, address.postcode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [street, cityStateZip, address.country].filter(Boolean).join(", ");
}
