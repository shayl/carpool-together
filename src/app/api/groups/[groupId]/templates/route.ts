import { z } from "zod";
import {
  dateSchema,
  nullableTimeSchema,
  requireGroupRecord,
  timeSchema,
  validDateRange,
  validTimeRange,
} from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const templateSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    startsOn: dateSchema,
    endsOn: dateSchema,
    startTime: timeSchema,
    endTime: nullableTimeSchema,
    locationId: z.string().uuid(),
    needsTo: z.boolean().default(true),
    needsFrom: z.boolean().default(true),
    eventType: z.enum(["practice", "game", "competition"]).default("practice"),
    title: z.string().trim().min(1).max(160).nullable().optional(),
  })
  .refine((value) => validDateRange(value.startsOn, value.endsOn), {
    message: "End date must not precede start date.",
  })
  .refine((value) => validTimeRange(value.startTime, value.endTime), {
    message: "End time must be after start time.",
  });

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/templates">,
) {
  try {
    const { groupId } = await context.params;
    const input = templateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid recurring schedule." },
        { status: 400 },
      );
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    await requireGroupRecord(
      admin,
      "group_locations",
      groupId,
      input.data.locationId,
    );
    const { data, error } = await admin.rpc("create_weekly_group_schedule", {
      target_group_id: groupId,
      target_weekday: input.data.weekday,
      target_starts_on: input.data.startsOn,
      target_ends_on: input.data.endsOn,
      target_start_time: input.data.startTime,
      target_end_time: input.data.endTime ?? null,
      target_location_id: input.data.locationId,
      target_needs_to: input.data.needsTo,
      target_needs_from: input.data.needsFrom,
      target_event_type: input.data.eventType,
      target_title: input.data.title ?? null,
    });
    if (error) throw error;
    return Response.json({ id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
