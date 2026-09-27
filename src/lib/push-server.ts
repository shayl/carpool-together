import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatReminderLead,
  pickupTime,
  reminderIsDue,
  type ReminderMinutes,
} from "@/lib/push-reminders";
import type { RideLeg } from "@/lib/schedule-types";

type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_minutes: ReminderMinutes;
};

type DeliveryResult = "sent" | "skipped" | "failed";

export async function sendTestPush(subscriptionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,reminder_minutes")
    .eq("id", subscriptionId)
    .single();
  if (error || !data) throw error ?? new Error("Notification device not found.");
  return deliver(data as StoredSubscription, `test:${crypto.randomUUID()}`, "test", {
    title: "Carpool Together reminders are on",
    body: "This device is ready for driver reminders.",
    url: "/",
    tag: "push-test",
  });
}

export async function dispatchDueDriverReminders(now = new Date()) {
  const admin = createAdminClient();
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("group_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,reminder_minutes");
  if (subscriptionsError) throw subscriptionsError;
  if (!subscriptions?.length) return { sent: 0, skipped: 0, failed: 0 };

  const userIds = [...new Set(subscriptions.map((item) => item.user_id))];
  const { data: memberships, error: membershipsError } = await admin
    .from("group_memberships")
    .select("user_id,group_id,roster_entry_id")
    .in("user_id", userIds)
    .eq("status", "active")
    .not("roster_entry_id", "is", null);
  if (membershipsError) throw membershipsError;
  const rosterIds = (memberships ?? [])
    .map((item) => item.roster_entry_id)
    .filter((id): id is string => Boolean(id));
  if (!rosterIds.length) return { sent: 0, skipped: subscriptions.length, failed: 0 };

  const { data: households, error: householdsError } = await admin
    .from("group_households")
    .select("id,group_id,roster_entry_id")
    .in("roster_entry_id", rosterIds);
  if (householdsError) throw householdsError;
  const householdIds = (households ?? []).map((item) => item.id);
  const { data: claims, error: claimsError } = await admin
    .from("group_ride_claims")
    .select("id,group_id,event_id,leg,household_id")
    .in("household_id", householdIds);
  if (claimsError) throw claimsError;
  if (!claims?.length) return { sent: 0, skipped: subscriptions.length, failed: 0 };

  const eventIds = [...new Set(claims.map((item) => item.event_id))];
  const groupIds = [...new Set(claims.map((item) => item.group_id))];
  const [{ data: events, error: eventsError }, { data: groups, error: groupsError }] =
    await Promise.all([
      admin
        .from("group_events")
        .select("id,group_id,event_date,start_time,end_time,title,event_type,location_id")
        .in("id", eventIds),
      admin.from("groups").select("id,name,timezone").in("id", groupIds),
    ]);
  if (eventsError) throw eventsError;
  if (groupsError) throw groupsError;
  if (!events?.length) {
    return { sent: 0, skipped: subscriptions.length, failed: 0 };
  }
  const locationIds = [
    ...new Set((events ?? []).map((event) => event.location_id)),
  ];
  const { data: locations, error: locationsError } = await admin
    .from("group_locations")
    .select("id,name")
    .in("id", locationIds);
  if (locationsError) throw locationsError;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const rawSubscription of subscriptions) {
    const subscription = rawSubscription as StoredSubscription;
    const userRosterIds = new Set(
      (memberships ?? [])
        .filter((item) => item.user_id === subscription.user_id)
        .map((item) => item.roster_entry_id),
    );
    const userHouseholds = new Set(
      (households ?? [])
        .filter((item) => userRosterIds.has(item.roster_entry_id))
        .map((item) => item.id),
    );
    for (const claim of claims.filter((item) =>
      userHouseholds.has(item.household_id),
    )) {
      const event = (events ?? []).find((item) => item.id === claim.event_id);
      const group = (groups ?? []).find((item) => item.id === claim.group_id);
      if (!event || !group) {
        skipped += 1;
        continue;
      }
      const pickup = pickupTime(
        event.event_date,
        event.start_time,
        event.end_time,
        claim.leg as RideLeg,
        group.timezone,
      );
      if (
        !pickup ||
        !reminderIsDue(pickup, now, subscription.reminder_minutes)
      ) {
        skipped += 1;
        continue;
      }
      const eventName = event.title?.trim() || event.event_type;
      const direction =
        claim.leg === "to_event" ? `Drive to ${eventName}` : `Pickup from ${eventName}`;
      const time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: group.timezone,
      }).format(pickup);
      const result = await deliver(
        subscription,
        `driver:${claim.id}:${claim.leg}:${pickup.toISOString()}`,
        "driver_reminder",
        {
          title: `Carpool in ${formatReminderLead(subscription.reminder_minutes)}`,
          body: `${direction} at ${time} · ${
            locations?.find((item) => item.id === event.location_id)?.name ??
            group.name
          }`,
          url: "/",
          tag: `driver:${claim.id}:${claim.leg}`,
        },
      );
      if (result === "sent") sent += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }
  return { sent, skipped, failed };
}

async function deliver(
  subscription: StoredSubscription,
  key: string,
  kind: "driver_reminder" | "test",
  payload: { title: string; body: string; url: string; tag: string },
): Promise<DeliveryResult> {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("group_push_deliveries")
    .select("id")
    .eq("subscription_id", subscription.id)
    .eq("notification_key", key)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return "skipped";

  configureWebPush();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    const { error } = await admin.from("group_push_deliveries").insert({
      subscription_id: subscription.id,
      notification_key: key,
      kind,
    });
    if (error) throw error;
    return "sent";
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    if (statusCode === 404 || statusCode === 410) {
      const { error: deleteError } = await admin
        .from("group_push_subscriptions")
        .delete()
        .eq("id", subscription.id);
      if (deleteError) throw deleteError;
    } else {
      console.error("Push delivery failed", error);
    }
    return "failed";
  }
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ?? "https://carpool-together.vercel.app";
  if (!publicKey || !privateKey) {
    throw new Error("Driver reminders are not configured.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}
