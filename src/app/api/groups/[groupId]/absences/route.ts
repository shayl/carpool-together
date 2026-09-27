import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  currentHouseholdId,
  dateSchema,
  requireActiveGroupMember,
  validDateRange,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const periodFields = z
  .object({
    participantIds: z.array(z.string().uuid()).min(1).max(100),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine((value) => validDateRange(value.startsOn, value.endsOn), {
    message: "End date must not precede start date.",
  });
const patchSchema = periodFields.extend({
  periodGroupId: z.string().uuid(),
});
const deleteSchema = z.object({ periodGroupId: z.string().uuid() });

async function requireOwnedParticipants(
  admin: Awaited<ReturnType<typeof requireActiveGroupMember>>["admin"],
  groupId: string,
  householdId: string,
  participantIds: string[],
) {
  const uniqueIds = [...new Set(participantIds)];
  const { data, error } = await admin
    .from("participants")
    .select("id")
    .eq("group_id", groupId)
    .eq("household_id", householdId)
    .in("id", uniqueIds);
  if (error) throw error;
  if (data?.length !== uniqueIds.length) {
    throw Response.json(
      { error: "You may only manage participants in your household." },
      { status: 403 },
    );
  }
  return uniqueIds;
}

async function requireOwnedPeriod(
  admin: Awaited<ReturnType<typeof requireActiveGroupMember>>["admin"],
  groupId: string,
  householdId: string,
  periodGroupId: string,
) {
  const { data: periods, error } = await admin
    .from("group_absence_periods")
    .select("id, participant_id")
    .eq("group_id", groupId)
    .eq("period_group_id", periodGroupId);
  if (error) throw error;
  if (!periods?.length) {
    throw Response.json({ error: "Absence period not found." }, { status: 404 });
  }
  await requireOwnedParticipants(
    admin,
    groupId,
    householdId,
    periods.map((period) => period.participant_id),
  );
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/absences">,
) {
  try {
    const { groupId } = await context.params;
    const input = periodFields.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid absence period." }, { status: 400 });
    }
    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    const participantIds = await requireOwnedParticipants(
      admin,
      groupId,
      householdId,
      input.data.participantIds,
    );
    const periodGroupId = randomUUID();
    const { error } = await admin.from("group_absence_periods").insert(
      participantIds.map((participantId) => ({
        period_group_id: periodGroupId,
        group_id: groupId,
        participant_id: participantId,
        starts_on: input.data.startsOn,
        ends_on: input.data.endsOn,
        created_by: userId,
      })),
    );
    if (error) throw error;
    return Response.json({ periodGroupId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/absences">,
) {
  try {
    const { groupId } = await context.params;
    const input = patchSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid absence update." }, { status: 400 });
    }
    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    await requireOwnedPeriod(
      admin,
      groupId,
      householdId,
      input.data.periodGroupId,
    );
    const participantIds = await requireOwnedParticipants(
      admin,
      groupId,
      householdId,
      input.data.participantIds,
    );
    const { error: deleteError } = await admin
      .from("group_absence_periods")
      .delete()
      .eq("group_id", groupId)
      .eq("period_group_id", input.data.periodGroupId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await admin
      .from("group_absence_periods")
      .insert(
        participantIds.map((participantId) => ({
          period_group_id: input.data.periodGroupId,
          group_id: groupId,
          participant_id: participantId,
          starts_on: input.data.startsOn,
          ends_on: input.data.endsOn,
          created_by: userId,
        })),
      );
    if (insertError) throw insertError;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/absences">,
) {
  try {
    const { groupId } = await context.params;
    const input = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid absence id." }, { status: 400 });
    }
    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    await requireOwnedPeriod(
      admin,
      groupId,
      householdId,
      input.data.periodGroupId,
    );
    const { error } = await admin
      .from("group_absence_periods")
      .delete()
      .eq("group_id", groupId)
      .eq("period_group_id", input.data.periodGroupId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
