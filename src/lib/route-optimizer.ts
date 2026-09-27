export type GeoStop = {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type ResolvedGeoStop = GeoStop & {
  latitude: number;
  longitude: number;
};

export function optimizeStops(
  start: GeoStop,
  intermediate: GeoStop[],
  end: GeoStop,
) {
  const allStops = [start, ...intermediate, end];
  if (!allStops.every(hasCoordinates)) return allStops;
  if (intermediate.length < 2) return [start, ...intermediate, end];
  const resolvedStart = start as ResolvedGeoStop;
  const resolvedIntermediate = intermediate as ResolvedGeoStop[];
  if (intermediate.length > 8) {
    return [
      start,
      ...nearestNeighbor(resolvedStart, resolvedIntermediate),
      end,
    ];
  }

  let best = intermediate;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const order of permutations(resolvedIntermediate)) {
    const distance = routeDistance([
      resolvedStart,
      ...order,
      end as ResolvedGeoStop,
    ]);
    if (distance < bestDistance) {
      best = order;
      bestDistance = distance;
    }
  }
  return [start, ...best, end];
}

export function haversineMiles(
  first: Pick<ResolvedGeoStop, "latitude" | "longitude">,
  second: Pick<ResolvedGeoStop, "latitude" | "longitude">,
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

function nearestNeighbor(start: ResolvedGeoStop, stops: ResolvedGeoStop[]) {
  const remaining = [...stops];
  const ordered: ResolvedGeoStop[] = [];
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

function routeDistance(route: ResolvedGeoStop[]) {
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

export function hasCoordinates(stop: GeoStop): stop is ResolvedGeoStop {
  return (
    stop.latitude !== null &&
    stop.longitude !== null &&
    Number.isFinite(stop.latitude) &&
    Number.isFinite(stop.longitude)
  );
}
