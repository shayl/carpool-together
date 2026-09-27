import type { GroupRole } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Coordinate, DriverOffer, Participant } from "@/lib/carpool";

export type AppRosterEntry = {
  id: string;
  displayName: string;
  phone?: string;
  role: GroupRole;
  active: boolean;
};

export type AppGroup = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  role: GroupRole;
  canManageRoster: boolean;
  roster: AppRosterEntry[];
  event: string | null;
  destination: Coordinate;
  participants: Participant[];
  drivers: DriverOffer[];
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
    .select("group_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) throw membershipsError;
  if (!memberships?.length) return [];

  const groupIds = memberships.map((membership) => membership.group_id);
  const [{ data: groups, error: groupsError }, { data: roster, error: rosterError }] =
    await Promise.all([
      admin
        .from("groups")
        .select("id, name, accent_color")
        .in("id", groupIds),
      admin
        .from("group_access_roster")
        .select("id, group_id, display_name, phone, role, active")
        .in("group_id", groupIds)
        .order("display_name"),
    ]);

  if (groupsError) throw groupsError;
  if (rosterError) throw rosterError;

  const groupById = new Map((groups ?? []).map((group) => [group.id, group]));
  return memberships.flatMap((membership): AppGroup[] => {
    const group = groupById.get(membership.group_id);
    if (!group) return [];

    const role = membership.role as GroupRole;
    const canManageRoster = role === "owner" || role === "admin";

    return [
      {
        id: group.id,
        name: group.name,
        shortName: initials(group.name),
        accent: group.accent_color,
        role,
        canManageRoster,
        event: null,
        destination: { lat: 0, lng: 0 },
        participants: [],
        drivers: [],
        roster: (roster ?? [])
          .filter((entry) => entry.group_id === group.id)
          .map((entry) => ({
            id: entry.id,
            displayName: entry.display_name,
            ...(canManageRoster ? { phone: entry.phone } : {}),
            role: entry.role as GroupRole,
            active: entry.active,
          })),
      },
    ];
  });
}
