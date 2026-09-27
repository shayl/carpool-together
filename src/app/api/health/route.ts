import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    if (!process.env.AUTH_RATE_LIMIT_SECRET) {
      throw new Error("AUTH_RATE_LIMIT_SECRET is missing.");
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("groups")
      .select("id", { count: "exact", head: true });
    if (error) throw error;

    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { status: "unhealthy" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
