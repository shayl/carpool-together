import { hasCoordinates, type GeoStop } from "./route-optimizer";

export type NavigationProvider = "google" | "apple" | "waze";

export const navigationProviderKey = "carpool-navigation-provider";

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

export function placeUrl(provider: NavigationProvider, stop: GeoStop) {
  const location = coordinate(stop);
  if (provider === "google") {
    const params = new URLSearchParams({ api: "1", query: location });
    return `https://www.google.com/maps/search/?${params}`;
  }
  return provider === "apple"
    ? `https://maps.apple.com/?q=${encodeURIComponent(location)}`
    : `https://www.waze.com/ul?q=${encodeURIComponent(location)}`;
}

export function savedNavigationProvider(
  value: string | null,
): NavigationProvider {
  return value === "google" || value === "apple" || value === "waze"
    ? value
    : "google";
}

export function navigationTarget() {
  const mobile =
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent));
  return mobile ? "_self" : "_blank";
}

function coordinate(stop: GeoStop) {
  return hasCoordinates(stop)
    ? `${stop.latitude},${stop.longitude}`
    : stop.address;
}
