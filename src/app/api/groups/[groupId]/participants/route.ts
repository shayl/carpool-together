import { z } from "zod";
import {
  currentHouseholdId,
  requireActiveGroupMember,
} from "@/lib/group-schedule-api";
import { apiError } from "@/lib/server-auth";

const participantSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const participantIdSchema = z.object({
  participantId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/participants">,
) {
  try {
    const { groupId } = await context.params;
    const input = participantSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json({ error: "Enter a rider name." }, { status: 400 });
    }

    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    const { data, error } = await admin
      .from("participants")
      .insert({
        group_id: groupId,
        household_id: householdId,
        display_name: input.data.name,
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
  context: RouteContext<"/api/groups/[groupId]/participants">,
) {
  try {
    const { groupId } = await context.params;
    const input = participantIdSchema
      .extend({ name: participantSchema.shape.name })
      .safeParse(await request.json().catch(() => null));
    if (!input.success) {
      return Response.json({ error: "Enter a rider name." }, { status: 400 });
    }

    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    const { data, error } = await admin
      .from("participants")
      .update({ display_name: input.data.name })
      .eq("group_id", groupId)
      .eq("id", input.data.participantId)
      .eq("household_id", householdId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return Response.json(
        { error: "Rider not found in your household." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/participants">,
) {
  try {
    const { groupId } = await context.params;
    const input = participantIdSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid rider details." },
        { status: 400 },
      );
    }

    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    const { data, error } = await admin
      .from("participants")
      .delete()
      .eq("group_id", groupId)
      .eq("id", input.data.participantId)
      .eq("household_id", householdId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return Response.json(
        { error: "Rider not found in your household." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
