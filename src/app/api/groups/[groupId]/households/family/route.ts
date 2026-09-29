import { z } from "zod";
import {
  currentHouseholdId,
  requireActiveGroupMember,
} from "@/lib/group-schedule-api";
import { normalizePhone } from "@/lib/phone";
import { apiError } from "@/lib/server-auth";

const familySchema = z
  .object({
    householdId: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().max(300),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    guardians: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(1).max(100),
          phone: z.string().min(7).max(30),
        }),
      )
      .min(1)
      .max(10),
    riders: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(1).max(100),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine(
    (input) =>
      new Set(input.guardians.map((guardian) => normalizePhone(guardian.phone)))
        .size === input.guardians.length,
    { message: "Each guardian must have a different phone number." },
  );

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/households/family">,
) {
  try {
    const { groupId } = await context.params;
    const input = familySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        {
          error:
            input.error.issues[0]?.message ?? "Invalid family details.",
        },
        { status: 400 },
      );
    }

    const { admin, userId } = await requireActiveGroupMember(groupId);
    const householdId = await currentHouseholdId(admin, groupId, userId);
    if (input.data.householdId !== householdId) {
      return Response.json(
        { error: "You may only update your own household." },
        { status: 403 },
      );
    }

    const [
      { data: household, error: householdReadError },
      { data: membership, error: membershipError },
      { data: existingGuardians, error: guardiansError },
      { data: existingRiders, error: ridersError },
    ] = await Promise.all([
      admin
        .from("group_households")
        .select("id, roster_entry_id")
        .eq("group_id", groupId)
        .eq("id", householdId)
        .single(),
      admin
        .from("group_memberships")
        .select("roster_entry_id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .eq("status", "active")
        .single(),
      admin
        .from("group_access_roster")
        .select("id")
        .eq("group_id", groupId)
        .eq("household_id", householdId)
        .eq("active", true),
      admin
        .from("participants")
        .select("id")
        .eq("group_id", groupId)
        .eq("household_id", householdId),
    ]);
    if (householdReadError) throw householdReadError;
    if (membershipError) throw membershipError;
    if (guardiansError) throw guardiansError;
    if (ridersError) throw ridersError;

    const guardianIds = new Set(
      (existingGuardians ?? []).map((guardian) => guardian.id),
    );
    const submittedGuardianIds = new Set(
      input.data.guardians.flatMap((guardian) =>
        guardian.id ? [guardian.id] : [],
      ),
    );
    const protectedGuardianIds = [
      household.roster_entry_id,
      membership.roster_entry_id,
    ].filter((id): id is string => Boolean(id));

    if (
      [...submittedGuardianIds].some((id) => !guardianIds.has(id)) ||
      protectedGuardianIds.some((id) => !submittedGuardianIds.has(id))
    ) {
      return Response.json(
        { error: "A protected guardian cannot be removed." },
        { status: 400 },
      );
    }

    const riderIds = new Set((existingRiders ?? []).map((rider) => rider.id));
    const submittedRiderIds = new Set(
      input.data.riders.flatMap((rider) => (rider.id ? [rider.id] : [])),
    );
    if ([...submittedRiderIds].some((id) => !riderIds.has(id))) {
      return Response.json(
        { error: "A submitted rider does not belong to this household." },
        { status: 400 },
      );
    }

    for (const guardian of input.data.guardians) {
      if (guardian.id) {
        const { error } = await admin
          .from("group_access_roster")
          .update({
            display_name: guardian.name,
            phone: normalizePhone(guardian.phone),
          })
          .eq("group_id", groupId)
          .eq("household_id", householdId)
          .eq("id", guardian.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("group_access_roster").insert({
          group_id: groupId,
          household_id: householdId,
          display_name: guardian.name,
          phone: normalizePhone(guardian.phone),
          role: "member",
          active: true,
        });
        if (error) throw error;
      }
    }

    const removedGuardianIds = [...guardianIds].filter(
      (id) => !submittedGuardianIds.has(id),
    );
    if (removedGuardianIds.length) {
      const { error } = await admin
        .from("group_access_roster")
        .update({ active: false })
        .eq("group_id", groupId)
        .eq("household_id", householdId)
        .in("id", removedGuardianIds);
      if (error) throw error;
    }

    for (const rider of input.data.riders) {
      if (rider.id) {
        const { error } = await admin
          .from("participants")
          .update({ display_name: rider.name })
          .eq("group_id", groupId)
          .eq("household_id", householdId)
          .eq("id", rider.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("participants").insert({
          group_id: groupId,
          household_id: householdId,
          display_name: rider.name,
        });
        if (error) throw error;
      }
    }

    const removedRiderIds = [...riderIds].filter(
      (id) => !submittedRiderIds.has(id),
    );
    if (removedRiderIds.length) {
      const { error } = await admin
        .from("participants")
        .delete()
        .eq("group_id", groupId)
        .eq("household_id", householdId)
        .in("id", removedRiderIds);
      if (error) throw error;
    }

    const { error: householdError } = await admin
      .from("group_households")
      .update({
        name: input.data.name,
        address: input.data.address,
        latitude: input.data.latitude,
        longitude: input.data.longitude,
        updated_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("id", householdId);
    if (householdError) throw householdError;

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
