import { fromZonedTime } from "date-fns-tz";
import type { RideLeg } from "./schedule-types";

export const DEFAULT_REMINDER_MINUTES = 60;
export const REMINDER_MINUTE_OPTIONS = [15, 30, 60, 90, 120] as const;
export type ReminderMinutes = (typeof REMINDER_MINUTE_OPTIONS)[number];

export function pickupTime(
  date: string,
  startTime: string,
  endTime: string | null,
  leg: RideLeg,
  timezone: string,
) {
  const time = leg === "to_event" ? startTime : endTime;
  return time ? fromZonedTime(`${date}T${time}`, timezone) : null;
}

export function reminderIsDue(
  pickup: Date,
  now: Date,
  reminderMinutes: ReminderMinutes,
) {
  const reminderAt = pickup.getTime() - reminderMinutes * 60 * 1000;
  return now.getTime() >= reminderAt && now.getTime() < pickup.getTime();
}

export function formatReminderLead(minutes: ReminderMinutes) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "1 hour";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${Math.floor(minutes / 60)} hour ${minutes % 60} minutes`;
}
