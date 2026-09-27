import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const rosterSchema = z.object({
  entries: z
    .array(
      z.object({
        displayName: z.string().trim().min(1).max(100),
        phone: z.string().min(7).max(30),
        role: z
          .enum(["admin", "coordinator", "member"])
          .default("member"),
      }),
    )
    .min(1)
    .max(100),
});

async function addRosterEntries(request: Request, groupId: string) {
  const input = rosterSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return Response.json(
      { error: "Add at least one valid name and phone number." },
      { status: 400 },
    );
  }

  const { admin } = await requireGroupRole(groupId, ["owner", "admin"]);
  const rows = input.data.entries.map((entry) => ({
    group_id: groupId,
    display_name: entry.displayName,
    phone: normalizePhone(entry.phone),
    role: entry.role,
    active: true,
  }));
  const { error } = await admin
    .from("group_access_roster")
    .upsert(rows, { onConflict: "group_id,phone" });

  if (error) throw error;
  return Response.json({ added: rows.length });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/groups/[groupId]/roster">,
) {
  try {
    const { groupId } = await context.params;
    return await addRosterEntries(request, groupId);
  } catch (error) {
    return apiError(error);
  }
}
