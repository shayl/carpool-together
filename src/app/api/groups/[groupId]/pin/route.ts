import { prepareGeneratedGroupPin } from "@/lib/group-pin";
import { apiError, requireGroupRole } from "@/lib/server-auth";

export async function PATCH(
  _request: Request,
  context: RouteContext<"/api/groups/[groupId]/pin">,
) {
  try {
    const { groupId } = await context.params;
    const { admin } = await requireGroupRole(groupId, ["owner"]);
    const { data: legacyGroups, error: legacyGroupsError } = await admin
      .from("groups")
      .select("pin_hash")
      .is("pin_fingerprint", null)
      .neq("id", groupId);
    if (legacyGroupsError) throw legacyGroupsError;
    const legacyPinHashes = (legacyGroups ?? []).map((group) => group.pin_hash);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const pin = await prepareGeneratedGroupPin(legacyPinHashes);
      const { error } = await admin
        .from("groups")
        .update({
          pin_hash: pin.pinHash,
          pin_fingerprint: pin.pinFingerprint,
        })
        .eq("id", groupId);
      if (!error) return Response.json({ ok: true, pin: pin.pin });
      if (error.code !== "23505") throw error;
    }
    return Response.json(
      { error: "Could not generate a unique group PIN. Try again." },
      { status: 503 },
    );
  } catch (error) {
    return apiError(error);
  }
}
