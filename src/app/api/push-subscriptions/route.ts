import { z } from "zod";
import { sendTestPush } from "@/lib/push-server";
import { REMINDER_MINUTE_OPTIONS } from "@/lib/push-reminders";
import { apiError, requireUserId } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const reminderMinutes = z.number().refine((value) =>
  REMINDER_MINUTE_OPTIONS.some((option) => option === value),
);
const endpoint = z.object({ endpoint: z.url().max(2048) });
const subscription = endpoint.extend({
  expirationTime: z.number().int().nonnegative().nullable(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  reminderMinutes,
});

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return Response.json(
        { error: "Driver reminders are not configured yet." },
        { status: 503 },
      );
    }
    const requestedEndpoint = new URL(request.url).searchParams.get("endpoint");
    if (!requestedEndpoint) {
      return Response.json({ publicKey, reminderMinutes: 60, subscribed: false });
    }
    const parsedEndpoint = z.url().max(2048).parse(requestedEndpoint);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("group_push_subscriptions")
      .select("reminder_minutes")
      .eq("endpoint", parsedEndpoint)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return Response.json({
      publicKey,
      reminderMinutes: data?.reminder_minutes ?? 60,
      subscribed: Boolean(data),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const input = subscription.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("group_push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          expiration_time: input.expirationTime,
          reminder_minutes: input.reminderMinutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ ok: true, subscriptionId: data.id });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireUserId();
    const input = endpoint.extend({ reminderMinutes }).parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("group_push_subscriptions")
      .update({
        reminder_minutes: input.reminderMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("endpoint", input.endpoint)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return Response.json(
        { error: "This device is not subscribed." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId();
    const input = endpoint.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("group_push_subscriptions")
      .select("id")
      .eq("endpoint", input.endpoint)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return Response.json(
        { error: "Enable reminders on this device first." },
        { status: 404 },
      );
    }
    if ((await sendTestPush(data.id)) !== "sent") {
      return Response.json(
        { error: "The test reminder could not be delivered." },
        { status: 502 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId();
    const input = endpoint.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("group_push_subscriptions")
      .delete()
      .eq("endpoint", input.endpoint)
      .eq("user_id", userId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return Response.json(
        { error: "This device is not subscribed." },
        { status: 404 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
