import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type GroupRole = "owner" | "admin" | "coordinator" | "member";

export async function requireUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;

  if (error || !userId) {
    throw Response.json({ error: "Sign-in required." }, { status: 401 });
  }

  return userId;
}

export async function requireGroupRole(
  groupId: string,
  allowedRoles: GroupRole[],
) {
  const userId = await requireUserId();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data || !allowedRoles.includes(data.role as GroupRole)) {
    throw Response.json(
      { error: "You do not have permission for this group." },
      { status: 403 },
    );
  }

  return { admin, role: data.role as GroupRole, userId };
}

export function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
