import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { apiError, requireGroupRole } from "@/lib/server-auth";

const rosterSchema = z.object({
  entries: z
    .array(
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, "Enter the person's name.")
          .max(100, "The name is too long."),
        phone: z
          .string()
          .trim()
          .min(7, "The phone number is too short.")
          .max(30, "The phone number is too long."),
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
    // Say exactly which field was rejected; a generic message leaves people
    // guessing which of the two fields is the problem.
    const issue = input.error.issues[0];
    console.error("roster add rejected:", issue.path.join("."), issue.message);
    return Response.json({ error: issue.message }, { status: 400 });
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
