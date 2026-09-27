import { z } from "zod";
import {
  dateSchema,
  requireActiveGroupMember,
  validDateRange,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const optionalLabelSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => value || null)
  .nullable()
  .optional();

const breakFields = z
  .object({
    startsOn: dateSchema,
    endsOn: dateSchema,
    label: optionalLabelSchema,
  })
  .refine((value) => validDateRange(value.startsOn, value.endsOn), {
    message: "End date must not precede start date.",
  });
const patchSchema = z.object({
  id: z.string().uuid(),
  startsOn: dateSchema.optional(),
  endsOn: dateSchema.optional(),
  label: optionalLabelSchema,
});
const deleteSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/breaks">,
) {
  try {
    const { groupId } = await context.params;
    const input = breakFields.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid break dates." }, { status: 400 });
    }
    const { admin, userId } = await requireActiveGroupMember(groupId);
    const { data, error } = await admin
      .from("group_breaks")
      .insert({
        group_id: groupId,
        starts_on: input.data.startsOn,
        ends_on: input.data.endsOn,
        label: input.data.label ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/breaks">,
) {
  try {
    const { groupId } = await context.params;
    const input = patchSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid break update." }, { status: 400 });
    }
    const { admin } = await requireActiveGroupMember(groupId);
    const { data: current, error: currentError } = await admin
      .from("group_breaks")
      .select("starts_on, ends_on")
      .eq("group_id", groupId)
      .eq("id", input.data.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return Response.json({ error: "Break not found." }, { status: 404 });
    }
    if (
      !validDateRange(
        input.data.startsOn ?? current.starts_on,
        input.data.endsOn ?? current.ends_on,
      )
    ) {
      return Response.json({ error: "Invalid break dates." }, { status: 400 });
    }
    const { error } = await admin
      .from("group_breaks")
      .update({
        ...(input.data.startsOn !== undefined && {
          starts_on: input.data.startsOn,
        }),
        ...(input.data.endsOn !== undefined && {
          ends_on: input.data.endsOn,
        }),
        ...(input.data.label !== undefined && { label: input.data.label }),
        updated_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("id", input.data.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/breaks">,
) {
  try {
    const { groupId } = await context.params;
    const input = deleteSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Invalid break id." }, { status: 400 });
    }
    const { admin } = await requireActiveGroupMember(groupId);
    const { error } = await admin
      .from("group_breaks")
      .delete()
      .eq("group_id", groupId)
      .eq("id", input.data.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
