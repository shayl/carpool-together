import type { AccountRecord } from "@/lib/account";
import type { GroupRole } from "@/lib/server-auth";
import { loadGroupSchedules } from "@/lib/group-schedule-data";
import type { GroupSchedule } from "@/lib/schedule-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRosterEntry = {
  id: string;
  householdId: string | null;
  displayName: string;
  phone?: string;
  photoUrl?: string;
  role: GroupRole;
  active: boolean;
};

export type AppAccount = {
  id: string;
  phone: string;
  displayName: string;
  familyId: string | null;
};

export type AppFamily = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  riders: Array<{ id: string; name: string }>;
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
        .select("id, group_id, household_id, display_name, phone, photo_path, role, active")
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
    const schedule = schedules.get(group.id) ?? {
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
    };
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
        schedule,
        roster: groupRoster.map((entry) => ({
            id: entry.id,
            householdId: entry.household_id,
            displayName: entry.display_name,
            ...(canManageRoster ||
            entry.household_id === schedule.currentHouseholdId
              ? { phone: entry.phone }
              : {}),
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

// The account's own family: one address, one set of riders, shared by every
// group. Groups keep a copy of the address, but this is what people edit.
export async function loadAccountFamily(
  account: AccountRecord,
): Promise<AppFamily | null> {
  if (!account.family_id) return null;
  const admin = createAdminClient();
  const [{ data: family, error }, { data: riders, error: ridersError }] =
    await Promise.all([
      admin
        .from("families")
        .select("id, name, address, latitude, longitude")
        .eq("id", account.family_id)
        .maybeSingle(),
      admin
        .from("family_riders")
        .select("id, display_name")
        .eq("family_id", account.family_id)
        .order("display_name"),
    ]);

  if (error) throw error;
  if (ridersError) throw ridersError;
  if (!family) return null;

  return {
    id: family.id,
    name: family.name,
    address: family.address,
    latitude: family.latitude,
    longitude: family.longitude,
    riders: (riders ?? []).map((rider) => ({
      id: rider.id,
      name: rider.display_name,
    })),
  };
}
