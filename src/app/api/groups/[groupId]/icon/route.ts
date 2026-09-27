import {
  GROUP_IMAGES_BUCKET,
  imageResponse,
  newImagePath,
} from "@/lib/group-images";
import { apiError, requireGroupRole } from "@/lib/server-auth";

async function findIcon(groupId: string) {
  const { admin } = await requireGroupRole(groupId, [
    "owner",
    "admin",
    "coordinator",
    "member",
  ]);
  const { data, error } = await admin
    .from("groups")
    .select("icon_path")
    .eq("id", groupId)
    .single();

  if (error) throw error;
  return { admin, path: data.icon_path };
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/groups/[groupId]/icon">,
) {
  try {
    const { groupId } = await context.params;
    const { admin, path } = await findIcon(groupId);
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
  context: RouteContext<"/api/groups/[groupId]/icon">,
) {
  try {
    const { groupId } = await context.params;
    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      return Response.json({ error: "Choose an image." }, { status: 400 });
    }

    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("icon_path")
      .eq("id", groupId)
      .single();
    if (groupError) throw groupError;

    const path = newImagePath(`${groupId}/icon`, image);
    const { error: uploadError } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .upload(path, await image.arrayBuffer(), {
        contentType: image.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: updateError } = await admin
      .from("groups")
      .update({ icon_path: path })
      .eq("id", groupId);
    if (updateError) {
      await admin.storage.from(GROUP_IMAGES_BUCKET).remove([path]);
      throw updateError;
    }

    if (group.icon_path) {
      const { error: removeError } = await admin.storage
        .from(GROUP_IMAGES_BUCKET)
        .remove([group.icon_path]);
      if (removeError) {
        console.error("Could not remove the replaced group icon.", removeError);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/groups/[groupId]/icon">,
) {
  try {
    const { groupId } = await context.params;
    const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
    const { data: group, error: groupError } = await admin
      .from("groups")
      .select("icon_path")
      .eq("id", groupId)
      .single();
    if (groupError) throw groupError;
    if (!group.icon_path) return Response.json({ ok: true });

    const { error: removeError } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .remove([group.icon_path]);
    if (removeError) throw removeError;
    const { error: updateError } = await admin
      .from("groups")
      .update({ icon_path: null })
      .eq("id", groupId);
    if (updateError) throw updateError;

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
