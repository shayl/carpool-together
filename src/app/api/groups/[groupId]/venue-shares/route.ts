import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireGroupRecord } from "@/lib/group-schedule-api";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const shareSchema = z.object({
  locationId: z.string().uuid(),
});

const importSchema = z.object({
  token: z.string().trim().min(16).max(64),
});

// Publishing a venue stores an immutable snapshot. Later edits in the source
// group never reach groups that already imported it.
export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/venue-shares">,
) {
  try {
    const { groupId } = await context.params;
    const input = shareSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json({ error: "Choose a venue to share." }, { status: 400 });
    }

    const { admin, userId } = await requireGroupRole(groupId, [
      "owner",
      "admin",
    ]);
    await requireGroupRecord(
      admin,
      "group_locations",
      groupId,
      input.data.locationId,
    );

    const { data: venue, error: venueError } = await admin
      .from("group_locations")
      .select("name, address, latitude, longitude")
      .eq("group_id", groupId)
      .eq("id", input.data.locationId)
      .single();
    if (venueError) throw venueError;

    const token = randomBytes(24).toString("base64url");
    const { error } = await admin.from("group_venue_shares").insert({
      token,
      source_group_id: groupId,
      created_by: userId,
      name: venue.name,
      address: venue.address,
      latitude: venue.latitude,
      longitude: venue.longitude,
    });
    if (error) throw error;

    return Response.json({ token }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

// Importing copies the snapshot into this group. The copy is editable, and
// re-importing the same token resets it instead of adding a duplicate.
export async function PUT(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/venue-shares">,
) {
  try {
    const { groupId } = await context.params;
    const input = importSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      return Response.json({ error: "Invalid share link." }, { status: 400 });
    }

    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data: share, error: shareError } = await admin
      .from("group_venue_shares")
      .select("id, name, address, latitude, longitude")
      .eq("token", input.data.token)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!share) {
      return Response.json(
        { error: "This share link is no longer available." },
        { status: 404 },
      );
    }

    const values = {
      name: share.name,
      address: share.address,
      latitude: share.latitude,
      longitude: share.longitude,
    };
    const { data: existing, error: existingError } = await admin
      .from("group_locations")
      .select("id")
      .eq("group_id", groupId)
      .eq("imported_share_id", share.id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { error } = await admin
        .from("group_locations")
        .update(values)
        .eq("group_id", groupId)
        .eq("id", existing.id);
      if (error) throw error;
      return Response.json({ ok: true, reset: true });
    }

    const { error } = await admin.from("group_locations").insert({
      group_id: groupId,
      ...values,
      imported_share_id: share.id,
    });
    if (error) throw error;
    return Response.json({ ok: true, reset: false }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
