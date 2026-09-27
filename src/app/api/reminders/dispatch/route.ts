import { dispatchDueDriverReminders } from "@/lib/push-server";
import { apiError } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || authorization !== `Bearer ${secret}`) {
      return Response.json(
        { error: "Reminder dispatcher authorization failed." },
        { status: 401 },
      );
    }
    const reminders = await dispatchDueDriverReminders();
    return Response.json({ ok: true, reminders });
  } catch (error) {
    return apiError(error);
  }
}
