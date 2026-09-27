import {
  GROUP_IMAGES_BUCKET,
  imageResponse,
  newImagePath,
} from "@/lib/group-images";
import {
  apiError,
  requireGroupRole,
  requireUserId,
  type GroupRole,
} from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function requirePhotoEditor(groupId: string, rosterEntryId: string) {
  const userId = await requireUserId();
  const admin = createAdminClient();
  const { data: membership, error } = await admin
    .from("group_memberships")
    .select("role, roster_entry_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;

  const role = membership?.role as GroupRole | undefined;
  if (
    !membership ||
    (!["owner", "admin"].includes(role ?? "") &&
      membership.roster_entry_id !== rosterEntryId)
  ) {
    throw Response.json(
      { error: "You do not have permission for this group." },
      { status: 403 },
    );
  }

  return admin;
}

async function findRosterPhoto(groupId: string, rosterEntryId: string) {
  const { admin } = await requireGroupRole(groupId, [
    "owner",
    "admin",
    "coordinator",
    "member",
  ]);
  const { data, error } = await admin
    .from("group_access_roster")
    .select("photo_path")
    .eq("group_id", groupId)
    .eq("id", rosterEntryId)
    .single();
  if (error) throw error;
  return { admin, path: data.photo_path };
}

export async function GET(
  _request: Request,
  context: RouteContext<
    "/api/groups/[groupId]/roster/[rosterEntryId]/photo"
  >,
) {
  try {
    const { groupId, rosterEntryId } = await context.params;
    const { admin, path } = await findRosterPhoto(groupId, rosterEntryId);
    if (!path) return new Response(null, { status: 404 });

    const { data, error } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .download(path);
    if (error) throw error;
    return imageResponse(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<
    "/api/groups/[groupId]/roster/[rosterEntryId]/photo"
  >,
) {
  try {
    const { groupId, rosterEntryId } = await context.params;
    const admin = await requirePhotoEditor(groupId, rosterEntryId);
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return Response.json({ error: "Choose an image." }, { status: 400 });
    }

    const { data: roster, error: rosterError } = await admin
      .from("group_access_roster")
      .select("photo_path")
      .eq("group_id", groupId)
      .eq("id", rosterEntryId)
      .single();
    if (rosterError) throw rosterError;

    const path = newImagePath(
      `${groupId}/members/${rosterEntryId}`,
      image,
    );
    const { error: uploadError } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .upload(path, await image.arrayBuffer(), {
        contentType: image.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin
      .from("group_access_roster")
      .update({ photo_path: path })
      .eq("group_id", groupId)
      .eq("id", rosterEntryId);
    if (updateError) {
      await admin.storage.from(GROUP_IMAGES_BUCKET).remove([path]);
      throw updateError;
    }

    if (roster.photo_path) {
      const { error: removeError } = await admin.storage
        .from(GROUP_IMAGES_BUCKET)
        .remove([roster.photo_path]);
      if (removeError) {
        console.error(
          "Could not remove the replaced member photo.",
          removeError,
        );
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<
    "/api/groups/[groupId]/roster/[rosterEntryId]/photo"
  >,
) {
  try {
    const { groupId, rosterEntryId } = await context.params;
    const admin = await requirePhotoEditor(groupId, rosterEntryId);
    const { data: roster, error: rosterError } = await admin
      .from("group_access_roster")
      .select("photo_path")
      .eq("group_id", groupId)
      .eq("id", rosterEntryId)
      .single();
    if (rosterError) throw rosterError;
    if (!roster.photo_path) return Response.json({ ok: true });

    const { error: removeError } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .remove([roster.photo_path]);
    if (removeError) throw removeError;
    const { error: updateError } = await admin
      .from("group_access_roster")
      .update({ photo_path: null })
      .eq("group_id", groupId)
      .eq("id", rosterEntryId);
    if (updateError) throw updateError;

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
