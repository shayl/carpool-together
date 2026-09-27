"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { appIsInstalled } from "@/lib/install-prompt";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_REMINDER_MINUTES,
  formatReminderLead,
  REMINDER_MINUTE_OPTIONS,
  type ReminderMinutes,
} from "@/lib/push-reminders";

export function PushReminderSettings() {
  const { t } = useI18n();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [appleNeedsInstall, setAppleNeedsInstall] = useState(false);
  const [reminderMinutes, setReminderMinutes] =
    useState<ReminderMinutes>(DEFAULT_REMINDER_MINUTES);

  useEffect(() => {
    async function initialize() {
      await Promise.resolve();
      const canPush =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setSupported(canPush);
      if (!canPush) return;
      setPermission(Notification.permission);
      const appleMobile =
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setAppleNeedsInstall(appleMobile && !appIsInstalled());
      try {
        const registration = await navigator.serviceWorker.ready;
        const current = await registration.pushManager.getSubscription();
        if (!current) return;
        const configuration = (await request(
          `/api/push-subscriptions?endpoint=${encodeURIComponent(current.endpoint)}`,
          "GET",
        )) as {
          reminderMinutes?: ReminderMinutes;
          subscribed?: boolean;
        };
        if (configuration.subscribed && configuration.reminderMinutes) {
          setSubscription(current);
          setReminderMinutes(configuration.reminderMinutes);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? t(caught.message)
            : t("Could not check reminder status."),
        );
      }
    }
    void initialize();
  }, [t]);

  async function enable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!navigator.onLine) {
        throw new Error("Reconnect before enabling reminders.");
      }
      if (appleNeedsInstall) {
        throw new Error(
          "Add the app to your Home Screen and open it from the icon before enabling reminders.",
        );
      }
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "Notifications are blocked in this device's settings."
            : "Notification permission was not granted.",
        );
      }
      const configuration = (await request(
        "/api/push-subscriptions",
        "GET",
      )) as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;
      const next =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64Key(configuration.publicKey),
        }));
      await request("/api/push-subscriptions", "POST", {
        ...next.toJSON(),
        reminderMinutes,
      });
      setSubscription(next);
      setMessage(t("Driver reminders are enabled on this device."));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not enable reminders."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeReminderTime(next: ReminderMinutes) {
    const previous = reminderMinutes;
    setReminderMinutes(next);
    setError("");
    setMessage("");
    if (!subscription) return;
    setBusy(true);
    try {
      if (!navigator.onLine) {
        throw new Error("Reconnect before changing reminder time.");
      }
      await request("/api/push-subscriptions", "PUT", {
        endpoint: subscription.endpoint,
        reminderMinutes: next,
      });
      setMessage(
        t("This device will remind you {{lead}} before pickup.", {
          lead: t(formatReminderLead(next)),
        }),
      );
    } catch (caught) {
      setReminderMinutes(previous);
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not change reminder time."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function testReminder() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/api/push-subscriptions", "PATCH", {
        endpoint: subscription.endpoint,
      });
      setMessage(t("Test reminder sent. Check this device's notifications."));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not send a test reminder."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/api/push-subscriptions", "DELETE", {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setMessage(t("Reminders are disabled on this device."));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not disable reminders."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card reminder-settings">
      <div className="card-heading">
        <h2>
          {subscription ? <BellRing size={20} /> : <Bell size={20} />}
          {t("Driver reminders")}
        </h2>
      </div>
      <p className="text-muted">
        {t(
          "Each adult chooses a reminder time on every device. Reminders are sent only for rides their family is driving.",
        )}
      </p>
      {supported === false && (
        <p className="notice">
          {t("This browser does not support app notifications.")}
        </p>
      )}
      {appleNeedsInstall && (
        <p className="notice">
          {t(
            "On iPhone and iPad, install the app first, then open it from the Home Screen.",
          )}
        </p>
      )}
      {permission === "denied" && (
        <p className="notice">
          {t(
            "Notifications are blocked. Enable them in this device's settings.",
          )}
        </p>
      )}
      {supported && permission !== "denied" && (
        <label>
          {t("Remind me before pickup")}
          <select
            className="input"
            value={reminderMinutes}
            disabled={busy}
            onChange={(event) =>
              void changeReminderTime(
                Number(event.target.value) as ReminderMinutes,
              )
            }
          >
            {REMINDER_MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t(formatReminderLead(minutes))}
              </option>
            ))}
          </select>
        </label>
      )}
      {supported && !subscription && permission !== "denied" && (
        <button
          className="primary-button"
          type="button"
          disabled={busy || appleNeedsInstall}
          onClick={() => void enable()}
        >
          <Bell size={18} />
          {busy ? t("Enabling…") : t("Enable reminders")}
        </button>
      )}
      {subscription && (
        <div className="reminder-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => void testReminder()}
          >
            <BellRing size={18} />
            {t("Send test")}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => void disable()}
          >
            <BellOff size={18} />
            {t("Disable on this device")}
          </button>
        </div>
      )}
      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-message">{message}</p>}
    </section>
  );
}

function base64Key(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(result?.error ?? "Notification settings could not be updated.");
  }
  return result ?? {};
}
