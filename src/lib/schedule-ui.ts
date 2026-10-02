import type { AppRosterEntry } from "./app-data";
import { format, parseISO, startOfWeek } from "date-fns";
import { isEventInBreak, requiredLegs, rideState } from "./schedule-state";
import type { GroupEvent, GroupSchedule, RideLeg } from "./schedule-types";

export type RideFilter = "all" | "open" | "mine";

export function eligibleCurrentDriver(
  roster: AppRosterEntry[],
  currentRosterEntryId?: string | null,
) {
  return roster.find(
    (member) =>
      member.id === currentRosterEntryId &&
      member.active &&
      Boolean(member.householdId),
  );
}

export function namedRideDriver(
  schedule: GroupSchedule,
  roster: AppRosterEntry[],
  event: GroupEvent,
  leg: RideLeg,
) {
  const ride = rideState(schedule, event, leg);
  return (
    roster.find((member) => member.id === ride.claim?.driverRosterEntryId)
      ?.displayName ?? ride.household?.name
  );
}

export function matchesRideFilter(
  schedule: GroupSchedule,
  event: GroupEvent,
  filter: RideFilter,
) {
  if (filter === "all") return true;
  return requiredLegs(event).some((leg) => {
    const ride = rideState(schedule, event, leg);
    return filter === "open" ? ride.open : ride.mine;
  });
}

export function sortedEvents(events: GroupEvent[]) {
  return [...events].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startTime.localeCompare(right.startTime) ||
      left.id.localeCompare(right.id),
  );
}

export function eventHasEnded(event: GroupEvent, now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return event.date < date ||
    (event.date === date && (event.endTime ?? event.startTime) <= time);
}

export function weekEventsForDisplay(events: GroupEvent[], cursorDate: string, now: Date) {
  const currentWeek = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") ===
    format(startOfWeek(parseISO(cursorDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const sorted = sortedEvents(events);
  return {
    currentWeek,
    primary: currentWeek ? sorted.filter((event) => !eventHasEnded(event, now)) : sorted,
    earlier: currentWeek ? sorted.filter((event) => eventHasEnded(event, now)) : [],
  };
}

export function nextUpcomingEvent(schedule: GroupSchedule, now: Date) {
  return sortedEvents(schedule.events).find(
    (event) => !isEventInBreak(schedule, event) && !eventHasEnded(event, now),
  );
}
