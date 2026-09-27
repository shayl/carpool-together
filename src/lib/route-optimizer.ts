export type GeoStop = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
};

export function optimizeStops(
  start: GeoStop,
  intermediate: GeoStop[],
  end: GeoStop,
) {
  if (intermediate.length < 2) return [start, ...intermediate, end];
  if (intermediate.length > 8) {
    return [start, ...nearestNeighbor(start, intermediate), end];
  }

  let best = intermediate;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const order of permutations(intermediate)) {
    const distance = routeDistance([start, ...order, end]);
    if (distance < bestDistance) {
      best = order;
      bestDistance = distance;
    }
  }
  return [start, ...best, end];
}

export function haversineMiles(
  first: Pick<GeoStop, "latitude" | "longitude">,
  second: Pick<GeoStop, "latitude" | "longitude">,
) {
  const radiusMiles = 3958.8;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighbor(start: GeoStop, stops: GeoStop[]) {
  const remaining = [...stops];
  const ordered: GeoStop[] = [];
  let current = start;
  while (remaining.length) {
    remaining.sort(
      (left, right) =>
        haversineMiles(current, left) - haversineMiles(current, right) ||
        left.label.localeCompare(right.label),
    );
    current = remaining.shift()!;
    ordered.push(current);
  }
  return ordered;
}

function routeDistance(route: GeoStop[]) {
  return route
    .slice(1)
    .reduce(
      (total, stop, index) => total + haversineMiles(route[index], stop),
      0,
    );
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, itemIndex) => itemIndex !== index)).map(
      (rest) => [item, ...rest],
    ),
  );
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
