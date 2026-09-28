import { z } from "zod";
import { requireGroupRecord } from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const locationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

const locationPatchSchema = z
  .object({
    locationId: z.string().uuid(),
    name: z.string().trim().min(1).max(160).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.address !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined,
    { message: "At least one venue field is required." },
  );

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/locations">,
) {
  try {
    const { groupId } = await context.params;
    const input = locationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid location details." },
        { status: 400 },
      );
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data, error } = await admin
      .from("group_locations")
      .insert({
        group_id: groupId,
        name: input.data.name,
        address: input.data.address,
        latitude: input.data.latitude ?? null,
        longitude: input.data.longitude ?? null,
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
  context: RouteContext<"/api/groups/[groupId]/locations">,
) {
  try {
    const { groupId } = await context.params;
    const input = locationPatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json(
        { error: "Invalid location details." },
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

    // A new address invalidates stored coordinates unless the caller supplies
    // fresh ones, so routes re-geocode instead of driving to the old pin.
    const clearCoordinates =
      input.data.address !== undefined &&
      input.data.latitude === undefined &&
      input.data.longitude === undefined;
    const { error } = await admin
      .from("group_locations")
      .update({
        ...(input.data.name !== undefined && { name: input.data.name }),
        ...(input.data.address !== undefined && {
          address: input.data.address,
          ...(clearCoordinates && { latitude: null, longitude: null }),
        }),
        ...(input.data.latitude !== undefined && {
          latitude: input.data.latitude,
        }),
        ...(input.data.longitude !== undefined && {
          longitude: input.data.longitude,
        }),
      })
      .eq("group_id", groupId)
      .eq("id", input.data.locationId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
