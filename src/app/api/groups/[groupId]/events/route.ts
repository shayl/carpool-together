import { z } from "zod";
import {
  dateSchema,
  nullableTimeSchema,
  requireGroupRecord,
  timeSchema,
  validTimeRange,
} from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const optionalTitleSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => value || null)
  .nullable()
  .optional();

const eventFields = z.object({
  date: dateSchema,
  startTime: timeSchema,
  endTime: nullableTimeSchema,
  locationId: z.string().uuid(),
  needsTo: z.boolean().default(true),
  needsFrom: z.boolean().default(true),
  eventType: z.enum(["practice", "game", "competition"]),
  title: optionalTitleSchema,
});

const createSchema = eventFields.refine(
  (value) => validTimeRange(value.startTime, value.endTime),
  { message: "End time must be after start time." },
);
const patchSchema = eventFields
  .partial()
  .extend({ eventId: z.string().uuid() })
  .refine((value) => Object.keys(value).some((key) => key !== "eventId"), {
    message: "At least one event field is required.",
  });
const deleteSchema = z.object({ eventId: z.string().uuid() });

async function parseBody(request: Request) {
  return request.json().catch(() => null);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/events">,
) {
  try {
    const { groupId } = await context.params;
    const input = createSchema.safeParse(await parseBody(request));
    if (!input.success) {
      return Response.json({ error: "Invalid event details." }, { status: 400 });
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    await requireGroupRecord(
      admin,
      "group_locations",
      groupId,
      input.data.locationId,
    );
    const { data, error } = await admin
      .from("group_events")
      .insert({
        group_id: groupId,
        event_date: input.data.date,
        start_time: input.data.startTime,
        end_time: input.data.endTime ?? null,
        location_id: input.data.locationId,
        needs_to: input.data.needsTo,
        needs_from: input.data.needsFrom,
        event_type: input.data.eventType,
        title: input.data.title ?? null,
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
  context: RouteContext<"/api/groups/[groupId]/events">,
) {
  try {
    const { groupId } = await context.params;
    const input = patchSchema.safeParse(await parseBody(request));
    if (!input.success) {
      return Response.json({ error: "Invalid event update." }, { status: 400 });
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data: current, error: currentError } = await admin
      .from("group_events")
      .select("start_time, end_time")
      .eq("group_id", groupId)
      .eq("id", input.data.eventId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }

    if (input.data.locationId) {
      await requireGroupRecord(
        admin,
        "group_locations",
        groupId,
        input.data.locationId,
      );
    }
    if (
      !validTimeRange(
        input.data.startTime ?? current.start_time,
        input.data.endTime === undefined ? current.end_time : input.data.endTime,
      )
    ) {
      return Response.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    const updates = {
      ...(input.data.date !== undefined && { event_date: input.data.date }),
      ...(input.data.startTime !== undefined && {
        start_time: input.data.startTime,
      }),
      ...(input.data.endTime !== undefined && { end_time: input.data.endTime }),
      ...(input.data.locationId !== undefined && {
        location_id: input.data.locationId,
      }),
      ...(input.data.needsTo !== undefined && { needs_to: input.data.needsTo }),
      ...(input.data.needsFrom !== undefined && {
        needs_from: input.data.needsFrom,
      }),
      ...(input.data.eventType !== undefined && {
        event_type: input.data.eventType,
      }),
      ...(input.data.title !== undefined && { title: input.data.title }),
      changed_at: new Date().toISOString(),
    };
    const { error } = await admin
      .from("group_events")
      .update(updates)
      .eq("group_id", groupId)
      .eq("id", input.data.eventId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/events">,
) {
  try {
    const { groupId } = await context.params;
    const input = deleteSchema.safeParse(await parseBody(request));
    if (!input.success) {
      return Response.json({ error: "Invalid event id." }, { status: 400 });
    }
    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { error } = await admin
      .from("group_events")
      .delete()
      .eq("group_id", groupId)
      .eq("id", input.data.eventId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
