import { z } from "zod";
import {
  currentHouseholdId,
  requireActiveGroupMember,
  requireGroupRecord,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const householdSchema = z
  .object({
    householdId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().max(300).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.address !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined,
    { message: "At least one household field is required." },
  );

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/households">,
) {
  try {
    const { groupId } = await context.params;
    const input = householdSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid household details." },
        { status: 400 },
      );
    }
    const { admin, role, userId } = await requireActiveGroupMember(groupId);
    const ownHouseholdId = await currentHouseholdId(admin, groupId, userId);
    const householdId = input.data.householdId ?? ownHouseholdId;
    if (
      householdId !== ownHouseholdId &&
      role !== "owner" &&
      role !== "admin"
    ) {
      return Response.json(
        { error: "You may only update your own household." },
        { status: 403 },
      );
    }
    await requireGroupRecord(admin, "group_households", groupId, householdId);
    const { error } = await admin
      .from("group_households")
      .update({
        ...(input.data.name !== undefined && { name: input.data.name }),
        ...(input.data.address !== undefined && {
          address: input.data.address,
        }),
        ...(input.data.latitude !== undefined && {
          latitude: input.data.latitude,
        }),
        ...(input.data.longitude !== undefined && {
          longitude: input.data.longitude,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("id", householdId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
