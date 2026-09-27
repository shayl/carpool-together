import { apiError, requireGroupRole } from "@/lib/server-auth";

async function deleteGroup(groupId: string) {
  const { admin } = await requireGroupRole(groupId, ["owner"]);
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
