import { GROUP_IMAGES_BUCKET } from "@/lib/group-images";
import { apiError, requireGroupRole } from "@/lib/server-auth";

async function deleteGroup(groupId: string) {
  const { admin } = await requireGroupRole(groupId, ["owner"]);
  const [{ data: group, error: groupError }, { data: roster, error: rosterError }] =
    await Promise.all([
      admin.from("groups").select("icon_path").eq("id", groupId).single(),
      admin
        .from("group_access_roster")
        .select("photo_path")
        .eq("group_id", groupId)
        .not("photo_path", "is", null),
    ]);

  if (groupError) throw groupError;
  if (rosterError) throw rosterError;
  const imagePaths = [
    group.icon_path,
    ...(roster ?? []).map((entry) => entry.photo_path),
  ].filter((path): path is string => Boolean(path));

  if (imagePaths.length) {
    const { error: storageError } = await admin.storage
      .from(GROUP_IMAGES_BUCKET)
      .remove(imagePaths);
    if (storageError) throw storageError;
  }

  const { error } = await admin.from("groups").delete().eq("id", groupId);

  if (error) throw error;
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/groups/[groupId]">,
) {
  try {
    const { groupId } = await context.params;
    return await deleteGroup(groupId);
  } catch (error) {
    return apiError(error);
  }
}
