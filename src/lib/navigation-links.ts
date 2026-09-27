import { hasCoordinates, type GeoStop } from "./route-optimizer";

export type NavigationProvider = "google" | "apple" | "waze";

export function googleRouteUrl(stops: GeoStop[]) {
  const params = new URLSearchParams({
    api: "1",
    origin: coordinate(stops[0]),
    destination: coordinate(stops.at(-1)!),
    travelmode: "driving",
  });
  const waypoints = stops.slice(1, -1).map(coordinate);
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

export function singleStopUrl(
  provider: Exclude<NavigationProvider, "google">,
  stop: GeoStop,
) {
  const coordinates = coordinate(stop);
  return provider === "apple"
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(coordinates)}&dirflg=d`
    : `https://www.waze.com/ul?ll=${encodeURIComponent(coordinates)}&navigate=yes`;
}

function coordinate(stop: GeoStop) {
  return hasCoordinates(stop)
    ? `${stop.latitude},${stop.longitude}`
    : stop.address;
}
