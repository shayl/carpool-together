import { z } from "zod";

export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const participantSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  location: coordinateSchema,
  needsRide: z.boolean(),
});

export const driverOfferSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  origin: coordinateSchema,
  seats: z.number().int().min(1).max(12),
});

export const suggestionRequestSchema = z.object({
  groupId: z.string().min(1),
  destination: coordinateSchema,
  participants: z.array(participantSchema).max(100),
  drivers: z.array(driverOfferSchema).max(30),
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type DriverOffer = z.infer<typeof driverOfferSchema>;
export type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;

export type SuggestedTrip = {
  driverId: string;
  driverName: string;
  riderIds: string[];
  estimatedDetourMiles: number;
  seatsRemaining: number;
};

export type SuggestionPlan = {
  trips: SuggestedTrip[];
  unassigned: Array<{ participantId: string; reason: string }>;
  assumptions: string[];
};

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(from: Coordinate, to: Coordinate) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(value));
}

export function suggestCarpools(input: SuggestionRequest): SuggestionPlan {
  const riders = input.participants
    .filter((participant) => participant.needsRide)
    .filter((participant) => participant.groupId === input.groupId)
    .sort(
      (left, right) =>
        distanceMiles(right.location, input.destination) -
          distanceMiles(left.location, input.destination) ||
        left.id.localeCompare(right.id),
    );

  const trips = input.drivers
    .filter((driver) => driver.groupId === input.groupId)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((driver) => ({
      driverId: driver.id,
      driverName: driver.name,
      riderIds: [] as string[],
      estimatedDetourMiles: 0,
      seatsRemaining: driver.seats,
      origin: driver.origin,
    }));

  const unassigned: SuggestionPlan["unassigned"] = [];

  for (const rider of riders) {
    const candidates = trips
      .filter((trip) => trip.seatsRemaining > 0)
      .map((trip) => {
        const direct = distanceMiles(trip.origin, input.destination);
        const viaRider =
          distanceMiles(trip.origin, rider.location) +
          distanceMiles(rider.location, input.destination);

        return {
          trip,
          addedMiles: Math.max(0, viaRider - direct),
        };
      })
      .sort(
        (left, right) =>
          left.addedMiles - right.addedMiles ||
          left.trip.driverId.localeCompare(right.trip.driverId),
      );

    const selected = candidates[0];
    if (!selected) {
      unassigned.push({
        participantId: rider.id,
        reason: "No remaining seats in an eligible vehicle.",
      });
      continue;
    }

    selected.trip.riderIds.push(rider.id);
    selected.trip.seatsRemaining -= 1;
    selected.trip.estimatedDetourMiles += selected.addedMiles;
  }

  return {
    trips: trips.map((trip) => ({
      driverId: trip.driverId,
      driverName: trip.driverName,
      riderIds: trip.riderIds,
      seatsRemaining: trip.seatsRemaining,
      estimatedDetourMiles: Number(trip.estimatedDetourMiles.toFixed(1)),
    })),
    unassigned,
    assumptions: [
      "Coordinates are fictional and straight-line distance is used in this version.",
      "Every requested rider consumes one passenger seat.",
      "Suggestions are drafts until a coordinator and each driver approve them.",
    ],
  };
}
