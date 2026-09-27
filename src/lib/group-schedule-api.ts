import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type GroupRole,
  requireGroupRole,
} from "@/lib/server-auth";

export const activeGroupRoles: GroupRole[] = [
  "owner",
  "admin",
  "coordinator",
  "member",
];

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
  }, "Invalid calendar date");

export const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

export const nullableTimeSchema = timeSchema.nullable().optional();
export const coordinateSchema = z.number().finite();

export function validDateRange(startsOn: string, endsOn: string) {
  return endsOn >= startsOn;
}

export function validTimeRange(startTime: string, endTime?: string | null) {
  return !endTime || endTime > startTime;
}

export async function requireActiveGroupMember(groupId: string) {
  return requireGroupRole(groupId, activeGroupRoles);
}

export async function requireGroupRecord(
  admin: SupabaseClient,
  table: string,
  groupId: string,
  id: string,
) {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("group_id", groupId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw Response.json({ error: "Record not found in this group." }, { status: 404 });
  }
}

export async function currentHouseholdId(
  admin: SupabaseClient,
  groupId: string,
  userId: string,
) {
  const { data: membership, error: membershipError } = await admin
    .from("group_memberships")
    .select("roster_entry_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership?.roster_entry_id) {
    throw Response.json(
      { error: "Your membership is not linked to a household." },
      { status: 409 },
    );
  }

  const { data: roster, error: rosterError } = await admin
    .from("group_access_roster")
    .select("household_id")
    .eq("group_id", groupId)
    .eq("id", membership.roster_entry_id)
    .maybeSingle();

  if (rosterError) throw rosterError;
  if (!roster?.household_id) {
    throw Response.json(
      { error: "Your membership is not linked to a household." },
      { status: 409 },
    );
  }

  return roster.household_id as string;
}
