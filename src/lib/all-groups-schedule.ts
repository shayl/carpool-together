import type { AppGroup } from "@/lib/app-data";
import type { GroupEvent, GroupSchedule } from "@/lib/schedule-types";

// The rides screen shows every group at once, but the schedule helpers --
// coverage, "we're driving", breaks, absences -- all read a single
// GroupSchedule. Rather than teach each of them about several groups, the
// groups are concatenated into one schedule.
//
// This is sound because every row already carries its own group, and because
// "mine" is decided per claim: `rideState` compares a claim's household to
// `currentHouseholdId`, so collecting each group's own household id keeps the
// answer right in all of them.
export function mergeGroupSchedules(groups: AppGroup[]): GroupSchedule {
  return {
    households: groups.flatMap((group) => group.schedule.households),
    participants: groups.flatMap((group) => group.schedule.participants),
    locations: groups.flatMap((group) => group.schedule.locations),
    events: groups.flatMap((group) => group.schedule.events),
    attendance: groups.flatMap((group) => group.schedule.attendance),
    claims: groups.flatMap((group) => group.schedule.claims),
    breaks: groups.flatMap((group) => group.schedule.breaks),
    absencePeriods: groups.flatMap((group) => group.schedule.absencePeriods),
    templates: groups.flatMap((group) => group.schedule.templates),
    // A person has one household per group; any of them means "my family".
    currentHouseholdIds: groups.flatMap((group) =>
      group.schedule.currentHouseholdId
        ? [group.schedule.currentHouseholdId]
        : [],
    ),
    currentHouseholdId: null,
  };
}

export function groupLabelsById(groups: AppGroup[]) {
  return new Map(groups.map((group) => [group.id, group.name]));
}

export function groupForEvent(groups: AppGroup[], event: GroupEvent) {
  return groups.find((group) => group.id === event.groupId) ?? groups[0];
}
