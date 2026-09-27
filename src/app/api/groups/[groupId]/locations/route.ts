import { z } from "zod";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const locationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

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
