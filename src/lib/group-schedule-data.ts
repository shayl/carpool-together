import type {
  AbsencePeriod,
  EventAttendance,
  GroupBreak,
  GroupEvent,
  GroupHousehold,
  GroupLocation,
  GroupParticipant,
  GroupSchedule,
  RideClaim,
  ScheduleTemplate,
} from "@/lib/schedule-types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadGroupSchedules(
  groupIds: string[],
  userId: string,
): Promise<Map<string, GroupSchedule>> {
  const schedules = new Map<string, GroupSchedule>();
  if (groupIds.length === 0) return schedules;

  const admin = createAdminClient();
  const { data: memberships, error: membershipsError } = await admin
    .from("group_memberships")
    .select("group_id, roster_entry_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("group_id", groupIds);

  if (membershipsError) throw membershipsError;
  const authorizedGroupIds = (memberships ?? []).map(
    (membership) => membership.group_id,
  );
  if (authorizedGroupIds.length === 0) return schedules;

  const [
    householdsResult,
    participantsResult,
    locationsResult,
    eventsResult,
    attendanceResult,
    claimsResult,
    breaksResult,
    absencesResult,
    templatesResult,
    rosterResult,
  ] = await Promise.all([
    admin
      .from("group_households")
      .select("id, group_id, roster_entry_id, name, address, latitude, longitude")
      .in("group_id", authorizedGroupIds),
    admin
      .from("participants")
      .select("id, group_id, household_id, roster_entry_id, display_name")
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_locations")
      .select("id, group_id, name, address, latitude, longitude")
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_events")
      .select(
        "id, group_id, template_id, event_date, start_time, end_time, location_id, needs_to, needs_from, event_type, title, changed_at",
      )
      .in("group_id", authorizedGroupIds)
      .order("event_date")
      .order("start_time"),
    admin
      .from("group_event_attendance")
      .select(
        "group_id, event_id, participant_id, absent, opt_out_to, opt_out_from, updated_at",
      )
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_ride_claims")
      .select("id, group_id, event_id, leg, household_id, claimed_by")
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_breaks")
      .select("id, group_id, starts_on, ends_on, label")
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_absence_periods")
      .select(
        "id, period_group_id, group_id, participant_id, starts_on, ends_on, created_at",
      )
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_schedule_templates")
      .select(
        "id, group_id, weekday, starts_on, ends_on, start_time, end_time, location_id, needs_to, needs_from",
      )
      .in("group_id", authorizedGroupIds),
    admin
      .from("group_access_roster")
      .select("id, group_id, household_id, photo_path")
      .in("group_id", authorizedGroupIds),
  ]);

  for (const result of [
    householdsResult,
    participantsResult,
    locationsResult,
    eventsResult,
    attendanceResult,
    claimsResult,
    breaksResult,
    absencesResult,
    templatesResult,
    rosterResult,
  ]) {
    if (result.error) throw result.error;
  }

  const byGroup = <T extends { group_id: string }>(
    rows: T[] | null,
    groupId: string,
  ) => (rows ?? []).filter((row) => row.group_id === groupId);

  for (const membership of memberships ?? []) {
    const rosterEntry = (rosterResult.data ?? []).find(
      (entry) =>
        entry.group_id === membership.group_id &&
        entry.id === membership.roster_entry_id,
    );

    schedules.set(membership.group_id, {
      households: byGroup(
        householdsResult.data,
        membership.group_id,
      ).map(
        (row): GroupHousehold => ({
          id: row.id,
          groupId: row.group_id,
          rosterEntryId: row.roster_entry_id,
          name: row.name,
          address: row.address,
          latitude: row.latitude,
          longitude: row.longitude,
        }),
      ),
      participants: byGroup(
        participantsResult.data,
        membership.group_id,
      ).map(
        (row): GroupParticipant => {
          const rosterEntry = (rosterResult.data ?? []).find(
            (entry) =>
              entry.group_id === membership.group_id &&
              entry.id === row.roster_entry_id,
          );
          return {
            id: row.id,
            groupId: row.group_id,
            householdId: row.household_id,
            rosterEntryId: row.roster_entry_id,
            name: row.display_name,
            ...(rosterEntry?.photo_path
              ? {
                  photoUrl: `/api/groups/${membership.group_id}/roster/${rosterEntry.id}/photo`,
                }
              : {}),
          };
        },
      ),
      locations: byGroup(locationsResult.data, membership.group_id).map(
        (row): GroupLocation => ({
          id: row.id,
          groupId: row.group_id,
          name: row.name,
          address: row.address,
          latitude: row.latitude,
          longitude: row.longitude,
        }),
      ),
      events: byGroup(eventsResult.data, membership.group_id).map(
        (row): GroupEvent => ({
          id: row.id,
          groupId: row.group_id,
          templateId: row.template_id,
          date: row.event_date,
          startTime: row.start_time,
          endTime: row.end_time,
          locationId: row.location_id,
          needsTo: row.needs_to,
          needsFrom: row.needs_from,
          eventType: row.event_type,
          title: row.title,
          changedAt: row.changed_at,
        }),
      ),
      attendance: byGroup(attendanceResult.data, membership.group_id).map(
        (row): EventAttendance => ({
          eventId: row.event_id,
          participantId: row.participant_id,
          absent: row.absent,
          optOutTo: row.opt_out_to,
          optOutFrom: row.opt_out_from,
          updatedAt: row.updated_at,
        }),
      ),
      claims: byGroup(claimsResult.data, membership.group_id).map(
        (row): RideClaim => ({
          id: row.id,
          eventId: row.event_id,
          leg: row.leg,
          householdId: row.household_id,
          claimedBy: row.claimed_by,
        }),
      ),
      breaks: byGroup(breaksResult.data, membership.group_id).map(
        (row): GroupBreak => ({
          id: row.id,
          groupId: row.group_id,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
          label: row.label,
        }),
      ),
      absencePeriods: byGroup(absencesResult.data, membership.group_id).map(
        (row): AbsencePeriod => ({
          id: row.id,
          periodGroupId: row.period_group_id,
          groupId: row.group_id,
          participantId: row.participant_id,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
          createdAt: row.created_at,
        }),
      ),
      templates: byGroup(templatesResult.data, membership.group_id).map(
        (row): ScheduleTemplate => ({
          id: row.id,
          groupId: row.group_id,
          weekday: row.weekday,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
          startTime: row.start_time,
          endTime: row.end_time,
          locationId: row.location_id,
          needsTo: row.needs_to,
          needsFrom: row.needs_from,
        }),
      ),
      currentHouseholdId: rosterEntry?.household_id ?? null,
    });
  }

  return schedules;
}
