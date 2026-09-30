import type {
  EventAttendance,
  GroupEvent,
  GroupParticipant,
  GroupSchedule,
  RideLeg,
} from "./schedule-types";

export function requiredLegs(event: GroupEvent): RideLeg[] {
  return [
    ...(event.needsTo ? ["to_event" as const] : []),
    ...(event.needsFrom ? ["from_event" as const] : []),
  ];
}

export function isEventInBreak(schedule: GroupSchedule, event: GroupEvent) {
  return (
    event.eventType === "practice" &&
    schedule.breaks.some(
      (period) => event.date >= period.startsOn && event.date <= period.endsOn,
    )
  );
}

export function effectiveAttendance(
  schedule: GroupSchedule,
  event: GroupEvent,
  participant: GroupParticipant,
): EventAttendance {
  const daily = schedule.attendance.find(
    (item) =>
      item.eventId === event.id && item.participantId === participant.id,
  );
  const absence = schedule.absencePeriods
    .filter(
      (period) =>
        period.participantId === participant.id &&
        event.date >= period.startsOn &&
        event.date <= period.endsOn,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (
    daily &&
    (!absence || daily.updatedAt >= absence.createdAt)
  ) {
    return daily;
  }

  const absent = Boolean(absence);
  return {
    eventId: event.id,
    participantId: participant.id,
    absent,
    optOutTo: absent,
    optOutFrom: absent,
    updatedAt: absence?.createdAt ?? "",
  };
}

export function participantsNeedingRide(
  schedule: GroupSchedule,
  event: GroupEvent,
  leg: RideLeg,
) {
  return schedule.participants.filter((participant) => {
    const attendance = effectiveAttendance(schedule, event, participant);
    if (attendance.absent) return false;
    return leg === "to_event"
      ? !attendance.optOutTo
      : !attendance.optOutFrom;
  });
}

export function rideState(
  schedule: GroupSchedule,
  event: GroupEvent,
  leg: RideLeg,
) {
  const participants = participantsNeedingRide(schedule, event, leg);
  const claim = schedule.claims.find(
    (item) => item.eventId === event.id && item.leg === leg,
  );
  const active =
    requiredLegs(event).includes(leg) &&
    !isEventInBreak(schedule, event) &&
    participants.length > 0;

  return {
    active,
    open: active && !claim,
    mine:
      active &&
      claim?.householdId === schedule.currentHouseholdId,
    claim,
    participants,
    household: schedule.households.find(
      (household) => household.id === claim?.householdId,
    ),
  };
}

export function eventCoverage(
  schedule: GroupSchedule,
  event: GroupEvent,
) {
  const rides = requiredLegs(event)
    .map((leg) => rideState(schedule, event, leg))
    .filter((ride) => ride.active);
  if (rides.length === 0) return "neutral" as const;
  return rides.every((ride) => ride.claim) ? ("covered" as const) : ("open" as const);
}

// Who is driving an event, in leg order and without repeats, so a single
// household covering both directions reads as one name.
export function eventDrivers(schedule: GroupSchedule, event: GroupEvent) {
  const names = requiredLegs(event)
    .map((leg) => rideState(schedule, event, leg))
    .filter((ride) => ride.active && ride.claim)
    .map((ride) => ride.household?.name)
    .filter((name): name is string => Boolean(name));

  return [...new Set(names)];
}

export function driveCounts(schedule: GroupSchedule) {
  return schedule.households
    .map((household) => ({
      household,
      count: schedule.claims.filter((claim) => {
        if (claim.householdId !== household.id) return false;
        const event = schedule.events.find((item) => item.id === claim.eventId);
        return event ? rideState(schedule, event, claim.leg).active : false;
      }).length,
    }))
    .sort(
      (left, right) =>
        left.count - right.count ||
        left.household.name.localeCompare(right.household.name),
    );
}
