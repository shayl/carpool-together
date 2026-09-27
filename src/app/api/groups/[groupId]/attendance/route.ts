import { z } from "zod";
import {
  requireActiveGroupMember,
  requireGroupRecord,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const attendanceSchema = z.object({
  eventId: z.string().uuid(),
  participantId: z.string().uuid(),
  absent: z.boolean(),
  optOutTo: z.boolean(),
  optOutFrom: z.boolean(),
});

export async function PUT(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/attendance">,
) {
  try {
    const { groupId } = await context.params;
    const input = attendanceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid attendance details." },
        { status: 400 },
      );
    }
    const { admin } = await requireActiveGroupMember(groupId);
    await Promise.all([
      requireGroupRecord(admin, "group_events", groupId, input.data.eventId),
      requireGroupRecord(
        admin,
        "participants",
        groupId,
        input.data.participantId,
      ),
    ]);
    const { error } = await admin.from("group_event_attendance").upsert(
      {
        group_id: groupId,
        event_id: input.data.eventId,
        participant_id: input.data.participantId,
        absent: input.data.absent,
        opt_out_to: input.data.absent || input.data.optOutTo,
        opt_out_from: input.data.absent || input.data.optOutFrom,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,participant_id" },
    );
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
