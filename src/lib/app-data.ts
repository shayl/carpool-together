import type { GroupRole } from "@/lib/server-auth";
import { loadGroupSchedules } from "@/lib/group-schedule-data";
import type { GroupSchedule } from "@/lib/schedule-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRosterEntry = {
  id: string;
  displayName: string;
  phone?: string;
  photoUrl?: string;
  role: GroupRole;
  active: boolean;
};

export type AppGroup = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  iconUrl?: string;
  role: GroupRole;
  canManageRoster: boolean;
  currentRosterEntryId: string | null;
  currentMemberName: string;
  roster: AppRosterEntry[];
  schedule: GroupSchedule;
};

function initials(value: string) {
  const result = value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return result || "CT";
}

export async function loadAppData(userId: string) {
  const admin = createAdminClient();
  const { data: memberships, error: membershipsError } = await admin
    .from("group_memberships")
    .select("group_id, role, roster_entry_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) throw membershipsError;
  if (!memberships?.length) return [];

  const groupIds = memberships.map((membership) => membership.group_id);
  const [
    { data: groups, error: groupsError },
    { data: roster, error: rosterError },
    schedules,
  ] = await Promise.all([
      admin
        .from("groups")
        .select("id, name, accent_color, icon_path")
        .in("id", groupIds),
      admin
        .from("group_access_roster")
        .select("id, group_id, display_name, phone, photo_path, role, active")
        .in("group_id", groupIds)
        .order("display_name"),
      loadGroupSchedules(groupIds, userId),
    ]);

  if (groupsError) throw groupsError;
  if (rosterError) throw rosterError;

  const groupById = new Map((groups ?? []).map((group) => [group.id, group]));
  return memberships.flatMap((membership): AppGroup[] => {
    const group = groupById.get(membership.group_id);
    if (!group) return [];

    const role = membership.role as GroupRole;
    const canManageRoster = role === "owner" || role === "admin";
    const groupRoster = (roster ?? []).filter(
      (entry) => entry.group_id === group.id,
    );
    const currentRosterEntry = groupRoster.find(
      (entry) => entry.id === membership.roster_entry_id,
    );

    return [
      {
        id: group.id,
        name: group.name,
        shortName: initials(group.name),
        accent: group.accent_color,
        ...(group.icon_path
          ? { iconUrl: `/api/groups/${group.id}/icon` }
          : {}),
        role,
        canManageRoster,
        currentRosterEntryId: membership.roster_entry_id,
        currentMemberName: currentRosterEntry?.display_name ?? "Member",
        schedule: schedules.get(group.id) ?? {
          households: [],
          participants: [],
          locations: [],
          events: [],
          attendance: [],
          claims: [],
          breaks: [],
          absencePeriods: [],
          templates: [],
          currentHouseholdId: null,
        },
        roster: groupRoster.map((entry) => ({
            id: entry.id,
            displayName: entry.display_name,
            ...(canManageRoster ? { phone: entry.phone } : {}),
            ...(entry.photo_path
              ? {
                  photoUrl: `/api/groups/${group.id}/roster/${entry.id}/photo`,
                }
              : {}),
            role: entry.role as GroupRole,
            active: entry.active,
          })),
      },
    ];
  });
}
