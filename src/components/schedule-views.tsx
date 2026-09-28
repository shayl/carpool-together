"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, he as hebrewLocale } from "date-fns/locale";
import {
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Route,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  groupResourceUrl,
  type GroupScheduleResource,
} from "@/lib/group-resource-url";
import {
  driveCounts,
  effectiveAttendance,
  eventCoverage,
  isEventInBreak,
  requiredLegs,
  rideState,
} from "@/lib/schedule-state";
import { AddressInput, type AddressValue } from "@/components/address-input";
import { MemberAvatar } from "@/components/member-avatar";
import {
  coverageMood,
  RideStatusCar,
} from "@/components/ride-status-car";
import {
  googleRouteUrl,
  navigationProviderKey,
  navigationTarget,
  placeUrl,
  savedNavigationProvider,
  singleStopUrl,
  type NavigationProvider,
} from "@/lib/navigation-links";
import type { GeoStop } from "@/lib/route-optimizer";
import type {
  EventType,
  GroupEvent,
  GroupSchedule,
  RideLeg,
} from "@/lib/schedule-types";
import { useI18n } from "@/lib/i18n";

type ScheduleView = "rides" | "family" | "team";

type Props = {
  groupId: string;
  groupName: string;
  canManage: boolean;
  view: ScheduleView;
  schedule: GroupSchedule;
};

const eventTypes: EventType[] = ["practice", "game", "competition"];

function displayDate(date: Date, pattern: string, locale: "en" | "he") {
  return format(date, pattern, {
    locale: locale === "he" ? hebrewLocale : enUS,
  });
}

function eventTitle(event: GroupEvent) {
  if (event.title) return event.title;
  if (event.eventType === "game") return "Special event";
  if (event.eventType === "competition") return "Trip or competition";
  return "Regular event";
}

function eventTypeLabel(eventType: EventType) {
  if (eventType === "game") return "Special event";
  if (eventType === "competition") return "Trip or competition";
  return "Regular event";
}

function legKey(leg: RideLeg) {
  return leg === "to_event" ? "Ride there" : "Ride home";
}

async function readResult(response: Response) {
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(result?.error ?? "Change failed.");
  }
}

export function ScheduleViews(props: Props) {
  if (props.view === "rides") return <RidesSchedule {...props} />;
  if (props.view === "family") return <FamilySchedule {...props} />;
  return <TeamSchedule {...props} />;
}

function useMutation(groupId: string) {
  const router = useRouter();
  const { t } = useI18n();
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function mutate(
    resource: GroupScheduleResource,
    method: string,
    body: unknown,
    key: string,
  ) {
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch(groupResourceUrl(groupId, resource), {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      await readResult(response);
      setMessage(method === "DELETE" ? t("Removed.") : t("Saved."));
      router.refresh();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? t(caught.message) : t("Change failed."),
      );
      return false;
    } finally {
      setBusyKey("");
    }
  }

  return { busyKey, error, message, mutate };
}

function RidesSchedule({ groupId, groupName, schedule }: Props) {
  const { t, locale } = useI18n();
  const mutation = useMutation(groupId);
  const [display, setDisplay] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [filter, setFilter] = useState<"all" | "open" | "mine">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const weekEnd = addDays(cursor, 6);
  const activeEvents = schedule.events.filter(
    (event) => !isEventInBreak(schedule, event),
  );
  const visibleEvents =
    display === "week"
      ? activeEvents.filter(
          (event) =>
            event.date >= format(cursor, "yyyy-MM-dd") &&
            event.date <= format(weekEnd, "yyyy-MM-dd"),
        )
      : activeEvents.filter((event) =>
          isSameMonth(parseISO(event.date), cursor),
        );
  const filteredEvents = visibleEvents.filter((event) => {
    if (filter === "all") return true;
    const rides = requiredLegs(event).map((leg) =>
      rideState(schedule, event, leg),
    );
    return filter === "open"
      ? rides.some((ride) => ride.open)
      : rides.some((ride) => ride.mine);
  });
  const rides = visibleEvents.flatMap((event) =>
    requiredLegs(event).map((leg) => rideState(schedule, event, leg)),
  );
  const open = rides.filter((ride) => ride.open).length;

  function move(direction: -1 | 1) {
    setCursor((current) =>
      display === "week"
        ? addDays(current, direction * 7)
        : addMonths(current, direction),
    );
  }

  function share() {
    const lines = [
      `*${groupName}*`,
      display === "week"
        ? `${displayDate(cursor, "MMM d", locale)}–${displayDate(weekEnd, "MMM d, yyyy", locale)}`
        : displayDate(cursor, "MMMM yyyy", locale),
      "",
    ];
    for (const event of visibleEvents) {
      const location = schedule.locations.find(
        (item) => item.id === event.locationId,
      );
      lines.push(
        `*${t(eventTitle(event))} · ${displayDate(parseISO(event.date), "EEE, MMM d", locale)} · ${event.startTime}*`,
      );
      if (location) lines.push(location.name);
      for (const leg of requiredLegs(event)) {
        const ride = rideState(schedule, event, leg);
        lines.push(
          `${t(legKey(leg))}: ${ride.household?.name ?? t("OPEN")}`,
        );
        if (ride.participants.length) {
          lines.push(
            `${t("Riders")}: ${ride.participants.map((item) => item.name).join(", ")}`,
          );
        }
      }
      lines.push("");
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <div className="screen-heading">
        <h1>{t("Rides")}</h1>
        <p>
          {display === "week"
            ? `${displayDate(cursor, "MMM d", locale)}–${displayDate(weekEnd, "MMM d, yyyy", locale)}`
            : displayDate(cursor, "MMMM yyyy", locale)}
        </p>
      </div>
      <section className="schedule-toolbar">
        <div className="ride-filters" role="group" aria-label={t("Calendar view")}>
          <button
            type="button"
            aria-pressed={display === "week"}
            onClick={() => setDisplay("week")}
          >
            {t("Week")}
          </button>
          <button
            type="button"
            aria-pressed={display === "month"}
            onClick={() => setDisplay("month")}
          >
            {t("Month")}
          </button>
        </div>
        <div className="schedule-navigation">
          <button
            className="icon-button"
            type="button"
            aria-label={t("Previous")}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              setCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            {t("Today")}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={t("Next")}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {display === "week" && (
        <>
          <div className={open ? "coverage-bar coverage-open" : "coverage-bar"}>
            {open ? <Car size={19} /> : <Check size={19} />}
            <strong>
              {open
                ? t("{{count}} rides need a driver", { count: open })
                : rides.length
                  ? t("All rides covered")
                  : t("No rides needed")}
            </strong>
            <button className="text-button" type="button" onClick={share}>
              {t("Share week")}
            </button>
          </div>
          <div className="ride-filters" role="group" aria-label={t("Ride filters")}>
            {(["all", "open", "mine"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(
                  value === "all"
                    ? "All"
                    : value === "open"
                      ? "Needs a family"
                      : "My family",
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {mutation.error && <p className="auth-error">{mutation.error}</p>}
      {mutation.message && <p className="auth-message">{mutation.message}</p>}

      {display === "month" ? (
        <MonthGrid
          cursor={cursor}
          events={filteredEvents}
          schedule={schedule}
          locale={locale}
          onOpen={(id) => {
            const event = schedule.events.find((item) => item.id === id);
            if (!event) return;
            setCursor(
              startOfWeek(parseISO(event.date), { weekStartsOn: 1 }),
            );
            setDisplay("week");
            setExpanded(id);
          }}
        />
      ) : filteredEvents.length ? (
        <section className="weekly-events-card">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              schedule={schedule}
              expanded={expanded === event.id}
              onToggle={() =>
                setExpanded((current) => (current === event.id ? null : event.id))
              }
              mutation={mutation}
            />
          ))}
        </section>
      ) : (
        <section className="surface-card">
          <h2>{t("No events scheduled")}</h2>
          <p className="text-muted">
            {t("Add an event from the Team tab.")}
          </p>
        </section>
      )}
    </>
  );
}

function MonthGrid({
  cursor,
  events,
  schedule,
  locale,
  onOpen,
}: {
  cursor: Date;
  events: GroupEvent[];
  schedule: GroupSchedule;
  locale: "en" | "he";
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });
  const leading = (monthStart.getDay() + 6) % 7;
  const dayNames =
    locale === "he"
      ? ["ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳", "א׳"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <section className="month-calendar">
      <div className="month-weekdays" aria-hidden="true">
        {dayNames.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="month-grid">
        {Array.from({ length: leading }, (_, index) => (
          <li key={`blank-${index}`} className="month-day month-day-empty" />
        ))}
        {days.map((day) => {
          const date = format(day, "yyyy-MM-dd");
          const dayEvents = events.filter((event) => event.date === date);
          return (
            <li key={date} className="month-day">
              <time dateTime={date}>{format(day, "d")}</time>
              <div className="month-events">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    className={`month-event month-event-${coverageMood(eventCoverage(schedule, event))}`}
                    type="button"
                    onClick={() => onOpen(event.id)}
                  >
                    <strong>{event.startTime}</strong>
                    <span>{t(eventTitle(event))}</span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EventCard({
  event,
  schedule,
  expanded,
  onToggle,
  mutation,
}: {
  event: GroupEvent;
  schedule: GroupSchedule;
  expanded: boolean;
  onToggle: () => void;
  mutation: ReturnType<typeof useMutation>;
}) {
  const { t, locale } = useI18n();
  const location = schedule.locations.find(
    (item) => item.id === event.locationId,
  );
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const selectedParticipant = schedule.participants.find(
    (participant) => participant.id === selectedParticipantId,
  );
  const coverage = eventCoverage(schedule, event);
  const openRides = requiredLegs(event).filter(
    (leg) => rideState(schedule, event, leg).open,
  ).length;
  const mood = coverageMood(coverage);

  return (
    <article className={`weekly-event weekly-event-${mood}`}>
      <button
        type="button"
        className="weekly-event-summary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="weekly-event-date">
          <strong>{displayDate(parseISO(event.date), "EEE", locale)}</strong>
          <span>{displayDate(parseISO(event.date), "MMM d", locale)}</span>
        </span>
        <span className="weekly-event-name">
          <strong>{t(eventTitle(event))}</strong>
          <span>
            {event.startTime}
            {location ? ` · ${location.name}` : ""}
          </span>
        </span>
        <span className="weekly-event-coverage">
          <RideStatusCar status={coverage} />
          <span>
            {coverage === "covered"
              ? t("All rides have drivers")
              : coverage === "open"
                ? t("{{count}} rides need a driver", { count: openRides })
                : t("No carpool needed")}
          </span>
        </span>
        <ChevronRight
          className={
            expanded ? "event-chevron event-chevron-expanded" : "event-chevron"
          }
          size={20}
        />
      </button>
      {expanded && (
        <div className="weekly-event-details">
          <div className="member-avatar-row" aria-label={t("Member ride status")}>
            {schedule.participants.map((participant) => {
              const attendance = effectiveAttendance(
                schedule,
                event,
                participant,
              );
              return (
                <button
                  type="button"
                  className={
                    attendance.absent ? "member-avatar-item is-inactive" : "member-avatar-item"
                  }
                  key={participant.id}
                  aria-label={t("Change ride status for {{name}}", {
                    name: participant.name,
                  })}
                  onClick={() => setSelectedParticipantId(participant.id)}
                >
                  <MemberAvatar
                    name={participant.name}
                    photoUrl={participant.photoUrl}
                    size={40}
                  />
                  <span>{participant.name.split(/\s+/)[0]}</span>
                </button>
              );
            })}
          </div>
          {requiredLegs(event).map((leg) => (
            <RideLegPanel
              key={leg}
              event={event}
              leg={leg}
              schedule={schedule}
              mutation={mutation}
            />
          ))}
          {selectedParticipant && (
            <ParticipantStatusEditor
              event={event}
              participant={selectedParticipant}
              schedule={schedule}
              mutation={mutation}
              onClose={() => setSelectedParticipantId(null)}
            />
          )}
        </div>
      )}
    </article>
  );
}

function RideLegPanel({
  event,
  leg,
  schedule,
  mutation,
}: {
  event: GroupEvent;
  leg: RideLeg;
  schedule: GroupSchedule;
  mutation: ReturnType<typeof useMutation>;
}) {
  const { t } = useI18n();
  const ride = rideState(schedule, event, leg);
  const [householdId, setHouseholdId] = useState(
    schedule.currentHouseholdId ?? schedule.households[0]?.id ?? "",
  );
  if (!ride.active) return null;
  const riderHouseholds = [
    ...new Map(
      ride.participants
        .map((participant) =>
          schedule.households.find(
            (household) => household.id === participant.householdId,
          ),
        )
        .filter((household) => household && household.id !== ride.household?.id)
        .map((household) => [household!.id, household!]),
    ).values(),
  ];

  return (
    <section className="ride-leg-panel">
      <div>
        <h3>{t(legKey(leg))}</h3>
        <p className="text-muted">
          {t("{{count}} riders", { count: ride.participants.length })}
        </p>
      </div>
      {ride.claim ? (
        <div className="claim-row">
          <strong>
            {ride.household?.name ?? t("Assigned family")}
          </strong>
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(mutation.busyKey)}
            onClick={() =>
              mutation.mutate(
                "claims",
                "DELETE",
                { eventId: event.id, leg },
                `release-${event.id}-${leg}`,
              )
            }
          >
            {t("Release ride")}
          </button>
        </div>
      ) : (
        <div className="claim-row">
          <select
            className="input"
            aria-label={t("Driving family")}
            value={householdId}
            onChange={(item) => setHouseholdId(item.target.value)}
          >
            {schedule.households.map((household) => (
              <option key={household.id} value={household.id}>
                {household.name}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            type="button"
            disabled={!householdId || Boolean(mutation.busyKey)}
            onClick={() =>
              mutation.mutate(
                "claims",
                "POST",
                { eventId: event.id, leg, householdId },
                `claim-${event.id}-${leg}`,
              )
            }
          >
            {t("We'll drive")}
          </button>
        </div>
      )}
      <p className="rider-list">
        {ride.participants.map((participant) => participant.name).join(", ")}
      </p>
      <div className="ride-address-list">
        {ride.household && (
          <address>
            <strong>{t("Driver: {{name}}", { name: ride.household.name })}</strong>
            <span>{ride.household.address || t("No address added")}</span>
          </address>
        )}
        {riderHouseholds.map((household) => (
          <address key={household.id}>
            <strong>{household.name}</strong>
            <span>{household.address || t("No address added")}</span>
          </address>
        ))}
      </div>
      {ride.claim && (
        <RouteLauncher groupId={event.groupId} event={event} leg={leg} />
      )}
    </section>
  );
}

function RouteLauncher({
  groupId,
  event,
  leg,
}: {
  groupId: string;
  event: GroupEvent;
  leg: RideLeg;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState<GeoStop[] | null>(null);
  const [routeOptimized, setRouteOptimized] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [sequentialProvider, setSequentialProvider] = useState<
    Exclude<NavigationProvider, "google"> | null
  >(null);
  const [nextStopIndex, setNextStopIndex] = useState(1);

  async function loadRoute() {
    const response = await fetch(`/api/groups/${groupId}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, leg }),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      stops?: GeoStop[];
      optimized?: boolean;
    } | null;
    if (!response.ok || !result?.stops) {
      throw new Error(result?.error ?? t("Could not build route."));
    }
    setRoute(result.stops);
    setRouteOptimized(result.optimized !== false);
    return result.stops;
  }

  async function openRoute(forceChoice = false) {
    setBusy(true);
    setError("");
    try {
      if (!navigator.onLine) throw new Error(t("Reconnect to open a route."));
      const preference = window.localStorage.getItem(navigationProviderKey);
      const saved =
        preference === "google" ||
        preference === "apple" ||
        preference === "waze"
          ? preference
          : null;
      const stops = route ?? (await loadRoute());
      if (stops.length < 2) {
        throw new Error(t("The route needs a start and destination."));
      }
      if (forceChoice || !saved) {
        setChoosing(true);
      } else {
        launchProvider(saved, stops);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not build route."),
      );
    } finally {
      setBusy(false);
    }
  }

  function launchProvider(provider: NavigationProvider, stops: GeoStop[]) {
    window.localStorage.setItem(navigationProviderKey, provider);
    setChoosing(false);
    if (provider === "google") {
      window.open(googleRouteUrl(stops), navigationTarget(), "noopener,noreferrer");
      return;
    }
    setSequentialProvider(provider);
    setNextStopIndex(2);
    window.open(
      singleStopUrl(provider, stops[1]),
      navigationTarget(),
      "noopener,noreferrer",
    );
  }

  function openNextStop() {
    if (!route || !sequentialProvider || nextStopIndex >= route.length) return;
    window.open(
      singleStopUrl(sequentialProvider, route[nextStopIndex]),
      navigationTarget(),
      "noopener,noreferrer",
    );
    setNextStopIndex((current) => current + 1);
  }

  return (
    <div className="route-launcher">
      <button
        className="text-button"
        type="button"
        disabled={busy}
        onClick={() => void openRoute()}
      >
        <Route size={17} />
        {busy ? t("Preparing route…") : t("Open route")}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={busy}
        onClick={() => void openRoute(true)}
      >
        {t("Change maps app")}
      </button>
      {error && <p className="auth-error">{error}</p>}
      {choosing && route && (
        <section
          className="route-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("Choose your maps app")}
        >
          <div
            className="participant-status-backdrop"
            onClick={() => setChoosing(false)}
          />
          <div className="route-sheet-panel">
            <div className="card-heading">
              <h3>{t("Choose your maps app")}</h3>
              <button
                className="icon-button"
                type="button"
                aria-label={t("Close")}
                onClick={() => setChoosing(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-muted">
              {t(
                "Google Maps opens every stop. Apple Maps and Waze guide one stop at a time.",
              )}
            </p>
            {!routeOptimized && (
              <p className="auth-message">
                {t(
                  "Some addresses could not be geocoded. Your maps app will determine the stop order.",
                )}
              </p>
            )}
            <RouteStops stops={route} />
            <div className="route-provider-actions">
              {(["google", "apple", "waze"] as NavigationProvider[]).map(
                (provider) => (
                  <button
                    className="primary-button"
                    type="button"
                    key={provider}
                    onClick={() => launchProvider(provider, route)}
                  >
                    {provider === "google"
                      ? "Google Maps"
                      : provider === "apple"
                        ? "Apple Maps"
                        : "Waze"}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>
      )}
      {sequentialProvider && route && (
        <section
          className="route-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("Route stops")}
        >
          <div
            className="participant-status-backdrop"
            onClick={() => setSequentialProvider(null)}
          />
          <div className="route-sheet-panel">
            <div className="card-heading">
              <h3>
                {sequentialProvider === "apple" ? "Apple Maps" : "Waze"}
              </h3>
              <button
                className="icon-button"
                type="button"
                aria-label={t("Close")}
                onClick={() => setSequentialProvider(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-muted">
              {t(
                "Return here when you are ready for the next stop. Opening a stop does not mark arrival.",
              )}
            </p>
            <RouteStops stops={route} currentIndex={nextStopIndex - 1} />
            {nextStopIndex < route.length ? (
              <button
                className="primary-button"
                type="button"
                onClick={openNextStop}
              >
                {t("Open next stop: {{name}}", {
                  name: route[nextStopIndex].label,
                })}
              </button>
            ) : (
              <p className="auth-message">{t("Final destination opened")}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function RouteStops({
  stops,
  currentIndex,
}: {
  stops: GeoStop[];
  currentIndex?: number;
}) {
  const { t } = useI18n();
  return (
    <ol className="route-stops">
      {stops.map((stop, index) => (
        <li
          className={index === currentIndex ? "route-stop-current" : ""}
          key={`${stop.label}-${index}`}
        >
          <strong>{index + 1}</strong>
          <span>
            <b>{stop.label}</b>
            <small>{stop.address}</small>
            {index === 0 && <small>{t("Starting point")}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ParticipantStatusEditor({
  event,
  participant,
  schedule,
  mutation,
  onClose,
}: {
  event: GroupEvent;
  participant: GroupSchedule["participants"][number];
  schedule: GroupSchedule;
  mutation: ReturnType<typeof useMutation>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const attendance = effectiveAttendance(schedule, event, participant);
  const save = (patch: Partial<typeof attendance>) =>
    mutation.mutate(
      "attendance",
      "PUT",
      {
        eventId: event.id,
        participantId: participant.id,
        absent: attendance.absent,
        optOutTo: attendance.optOutTo,
        optOutFrom: attendance.optOutFrom,
        ...patch,
      },
      `attendance-${event.id}-${participant.id}`,
    );

  return (
    <section
      className="participant-status-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={t("Ride status for {{name}}", { name: participant.name })}
    >
      <div className="participant-status-backdrop" onClick={onClose} />
      <div className="participant-status-panel">
        <div className="card-heading">
          <span className="attendance-member">
            <MemberAvatar
              name={participant.name}
              photoUrl={participant.photoUrl}
              size={48}
            />
            <span>
              <strong>{participant.name}</strong>
              <small>{t("Attendance and ride needs")}</small>
            </span>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label={t("Close")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <label className="status-choice">
          <input
            type="checkbox"
            checked={attendance.absent}
            onChange={(input) =>
              save({
                absent: input.target.checked,
                optOutTo: input.target.checked || attendance.optOutTo,
                optOutFrom: input.target.checked || attendance.optOutFrom,
              })
            }
          />
          <span>
            <strong>{t("Absent")}</strong>
            <small>{t("Not attending this event")}</small>
          </span>
        </label>
        {event.needsTo && (
          <label className="status-choice">
            <input
              type="checkbox"
              checked={!attendance.optOutTo && !attendance.absent}
              disabled={attendance.absent}
              onChange={(input) => save({ optOutTo: !input.target.checked })}
            />
            <span>
              <strong>{t("Needs ride there")}</strong>
              <small>{t("Include this member in the outbound ride")}</small>
            </span>
          </label>
        )}
        {event.needsFrom && (
          <label className="status-choice">
            <input
              type="checkbox"
              checked={!attendance.optOutFrom && !attendance.absent}
              disabled={attendance.absent}
              onChange={(input) => save({ optOutFrom: !input.target.checked })}
            />
            <span>
              <strong>{t("Needs ride home")}</strong>
              <small>{t("Include this member in the return ride")}</small>
            </span>
          </label>
        )}
        <button className="secondary-button" type="button" onClick={onClose}>
          {t("Done")}
        </button>
      </div>
    </section>
  );
}

function FamilySchedule({ groupId, schedule }: Props) {
  const { t, locale } = useI18n();
  const mutation = useMutation(groupId);
  const household = schedule.households.find(
    (item) => item.id === schedule.currentHouseholdId,
  );
  const participants = schedule.participants.filter(
    (item) => item.householdId === household?.id,
  );
  const [showAbsence, setShowAbsence] = useState(false);
  const [startsOn, setStartsOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endsOn, setEndsOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<string[]>(
    participants.map((item) => item.id),
  );
  const [addressDraft, setAddressDraft] = useState<{
    householdId: string | null;
    value: AddressValue;
  }>({
    householdId: household?.id ?? null,
    value: {
      address: household?.address ?? "",
      latitude: household?.latitude ?? null,
      longitude: household?.longitude ?? null,
    },
  });
  const address =
    addressDraft.householdId === household?.id
      ? addressDraft.value
      : {
          address: household?.address ?? "",
          latitude: household?.latitude ?? null,
          longitude: household?.longitude ?? null,
        };
  const futureEvents = schedule.events
    .filter(
      (event) =>
        event.date >= format(new Date(), "yyyy-MM-dd") &&
        !isEventInBreak(schedule, event),
    )
    .slice(0, 12);

  return (
    <>
      <div className="screen-heading">
        <h1>{t("My family")}</h1>
        <p>{household?.name ?? t("Your riders, your plans.")}</p>
      </div>
      {household && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <h2>{t("Home address")}</h2>
              <p className="text-muted">
                {t(
                  "Used only to coordinate pickups and routes within your group.",
                )}
              </p>
            </div>
          </div>
          <form
            className="schedule-form household-address-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutation.mutate(
                "households",
                "PATCH",
                {
                  address: address.address,
                  latitude: address.latitude,
                  longitude: address.longitude,
                },
                "save-address",
              );
            }}
          >
            <AddressInput
              label={t("Address")}
              required
              value={address}
              onChange={(next) =>
                setAddressDraft({ householdId: household.id, value: next })
              }
              placeholder={t("123 Main St, City")}
            />
            <button
              className="primary-button"
              disabled={
                mutation.busyKey === "save-address" ||
                !address.address.trim() ||
                address.address.trim() === household.address
              }
            >
              {mutation.busyKey === "save-address"
                ? t("Saving…")
                : t("Save address")}
            </button>
          </form>
        </section>
      )}
      <section className="surface-card">
        <h2>{t("Upcoming ride status")}</h2>
        {participants.map((participant) => (
          <div className="family-schedule" key={participant.id}>
            <h3>{participant.name}</h3>
            {futureEvents.map((event) => {
              const attendance = effectiveAttendance(
                schedule,
                event,
                participant,
              );
              const needed = requiredLegs(event).filter((leg) =>
                leg === "to_event"
                  ? !attendance.optOutTo
                  : !attendance.optOutFrom,
              );
              const open = needed.filter(
                (leg) => rideState(schedule, event, leg).open,
              ).length;
              return (
                <div className="family-event-row" key={event.id}>
                  <time dateTime={event.date}>
                    {displayDate(parseISO(event.date), "EEE, MMM d", locale)}
                  </time>
                  <strong>{t(eventTitle(event))}</strong>
                  <span>
                    {attendance.absent
                      ? t("Not attending")
                      : open
                        ? t("{{count}} rides need a driver", { count: open })
                        : needed.length
                          ? t("Covered")
                          : t("No rides needed")}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </section>
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Multi-day absences")}</h2>
            <p className="text-muted">
              {t("Apply an absence to several events at once.")}
            </p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowAbsence((value) => !value)}
          >
            <Plus size={18} />
            {t("Add absence")}
          </button>
        </div>
        {showAbsence && (
          <form
            className="schedule-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await mutation.mutate(
                "absences",
                "POST",
                { startsOn, endsOn, participantIds: selected },
                "add-absence",
              );
              if (saved) setShowAbsence(false);
            }}
          >
            <div className="participant-pills">
              {participants.map((participant) => (
                <label key={participant.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(participant.id)}
                    onChange={(input) =>
                      setSelected((current) =>
                        input.target.checked
                          ? [...current, participant.id]
                          : current.filter((id) => id !== participant.id),
                      )
                    }
                  />
                  {participant.name}
                </label>
              ))}
            </div>
            <label>
              {t("From")}
              <input
                className="input"
                type="date"
                required
                value={startsOn}
                onChange={(input) => setStartsOn(input.target.value)}
              />
            </label>
            <label>
              {t("Through")}
              <input
                className="input"
                type="date"
                min={startsOn}
                required
                value={endsOn}
                onChange={(input) => setEndsOn(input.target.value)}
              />
            </label>
            <button
              className="primary-button"
              disabled={!selected.length || endsOn < startsOn}
            >
              {t("Save absence")}
            </button>
          </form>
        )}
        {schedule.absencePeriods
          .filter((period) =>
            participants.some((item) => item.id === period.participantId),
          )
          .map((period) => (
            <div className="period-row" key={period.id}>
              <span>
                {
                  schedule.participants.find(
                    (item) => item.id === period.participantId,
                  )?.name
                }
              </span>
              <span>
                {period.startsOn} – {period.endsOn}
              </span>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  mutation.mutate(
                    "absences",
                    "DELETE",
                    { periodGroupId: period.periodGroupId },
                    `absence-${period.periodGroupId}`,
                  )
                }
              >
                {t("Remove")}
              </button>
            </div>
          ))}
      </section>
      {mutation.error && <p className="auth-error">{mutation.error}</p>}
      {mutation.message && <p className="auth-message">{mutation.message}</p>}
    </>
  );
}

function TeamSchedule({ groupId, canManage, schedule }: Props) {
  const { t } = useI18n();
  const mutation = useMutation(groupId);
  const [panel, setPanel] = useState<
    "event" | "recurring" | "venue" | "break" | null
  >(null);
  const [editingEvent, setEditingEvent] = useState<GroupEvent | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [importToken, setImportToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("venue") ?? ""),
  );
  const counts = driveCounts(schedule);

  async function shareVenue(locationId: string) {
    setShareLink("");
    const response = await fetch(`/api/groups/${groupId}/venue-shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    const result = (await response.json().catch(() => null)) as {
      token?: string;
    } | null;
    if (!response.ok || !result?.token) return false;
    const link = `${window.location.origin}/?venue=${result.token}`;
    await navigator.clipboard?.writeText(link).catch(() => undefined);
    setShareLink(link);
    return true;
  }

  return (
    <>
      <div className="screen-heading">
        <h1>{t("Team")}</h1>
        <p>{t("Schedule, breaks, families, and driving fairness.")}</p>
      </div>
      {canManage && (
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <h2>{t("Event schedule")}</h2>
              <p className="text-muted">
                {t("Add one-time events or recurring weekly events.")}
              </p>
            </div>
          </div>
          <div className="schedule-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setPanel("event");
              }}
            >
              <Plus size={18} />
              {t("One-time event")}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPanel("recurring")}
            >
              <CalendarDays size={18} />
              {t("Recurring weekly events")}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPanel("venue")}
            >
              <MapPin size={18} />
              {t("Add venue")}
            </button>
          </div>
          {panel === "event" && (
            <EventForm
              schedule={schedule}
              event={editingEvent}
              busy={Boolean(mutation.busyKey)}
              onCancel={() => {
                setPanel(null);
                setEditingEvent(null);
              }}
              onSave={async (body) => {
                const saved = await mutation.mutate(
                  "events",
                  editingEvent ? "PATCH" : "POST",
                  editingEvent ? { ...body, eventId: editingEvent.id } : body,
                  "save-event",
                );
                if (saved) {
                  setPanel(null);
                  setEditingEvent(null);
                }
              }}
            />
          )}
          {panel === "recurring" && (
            <RecurringForm
              schedule={schedule}
              busy={Boolean(mutation.busyKey)}
              onCancel={() => setPanel(null)}
              onSave={async (body) => {
                const saved = await mutation.mutate(
                  "templates",
                  "POST",
                  body,
                  "save-template",
                );
                if (saved) setPanel(null);
              }}
            />
          )}
          {panel === "venue" && (
            <VenueForm
              busy={Boolean(mutation.busyKey)}
              onCancel={() => setPanel(null)}
              onSave={async (body) => {
                const saved = await mutation.mutate(
                  "locations",
                  "POST",
                  body,
                  "save-location",
                );
                if (saved) setPanel(null);
              }}
            />
          )}
          <div className="manage-event-list">
            {schedule.events.slice(-12).reverse().map((event) => (
              <div className="period-row" key={event.id}>
                <span>
                  <strong>{t(eventTitle(event))}</strong>
                  <small>{event.date}</small>
                </span>
                <span className="row-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setEditingEvent(event);
                      setPanel("event");
                    }}
                  >
                    <Pencil size={16} />
                    {t("Edit")}
                  </button>
                  <button
                    className="text-button text-danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("Delete this event?"))) {
                        void mutation.mutate(
                          "events",
                          "DELETE",
                          { eventId: event.id },
                          `delete-event-${event.id}`,
                        );
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    {t("Delete")}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Venues")}</h2>
            <p className="text-muted">
              {t("Places your events meet. Open one to see it on a map.")}
            </p>
          </div>
          <MapPin size={22} />
        </div>
        {schedule.locations.length === 0 ? (
          <p className="text-muted">{t("No venues yet.")}</p>
        ) : (
          <div className="household-address-list">
            {schedule.locations.map((location) => (
              <VenueRow
                key={location.id}
                location={location}
                canManage={canManage}
                busy={Boolean(mutation.busyKey)}
                onShare={() => shareVenue(location.id)}
                onSave={(name, next) =>
                  mutation.mutate(
                    "locations",
                    "PATCH",
                    { locationId: location.id, name, ...next },
                    `venue-${location.id}`,
                  )
                }
              />
            ))}
          </div>
        )}
        {shareLink && (
          <p className="auth-message share-link">
            {t("Share link copied.")} <code>{shareLink}</code>
          </p>
        )}
        {canManage && (
          <form
            className="schedule-form"
            onSubmit={async (event) => {
              event.preventDefault();
              // Accept a full link or a bare token.
              const token = importToken.trim().split("venue=").at(-1)?.trim();
              const saved = await mutation.mutate(
                "venue-shares",
                "PUT",
                { token },
                "import-venue",
              );
              if (saved) setImportToken("");
            }}
          >
            <label>
              {t("Add a venue shared with you")}
              <input
                className="input"
                value={importToken}
                onChange={(input) => setImportToken(input.target.value)}
                placeholder={t("Paste a venue share link")}
              />
            </label>
            <button
              className="secondary-button"
              disabled={
                mutation.busyKey === "import-venue" || !importToken.trim()
              }
            >
              {mutation.busyKey === "import-venue"
                ? t("Adding…")
                : t("Add shared venue")}
            </button>
            <p className="auth-footnote">
              {t(
                "You get your own copy to edit. Adding the same link again restores the original details.",
              )}
            </p>
          </form>
        )}
      </section>

      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Group breaks")}</h2>
            <p className="text-muted">
              {t(
                "Regular events are paused during a break; special events remain visible.",
              )}
            </p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPanel(panel === "break" ? null : "break")}
          >
            <Plus size={18} />
            {t("Add break")}
          </button>
        </div>
        {panel === "break" && (
          <BreakForm
            busy={Boolean(mutation.busyKey)}
            onCancel={() => setPanel(null)}
            onSave={async (body) => {
              const saved = await mutation.mutate(
                "breaks",
                "POST",
                body,
                "save-break",
              );
              if (saved) setPanel(null);
            }}
          />
        )}
        {schedule.breaks.map((period) => (
          <div className="period-row" key={period.id}>
            <span>
              <strong>{period.label || t("Group break")}</strong>
              <small>
                {period.startsOn} – {period.endsOn}
              </small>
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                mutation.mutate(
                  "breaks",
                  "DELETE",
                  { id: period.id },
                  `break-${period.id}`,
                )
              }
            >
              {t("Remove")}
            </button>
          </div>
        ))}
      </section>

      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Household addresses")}</h2>
            <p className="text-muted">
              {t("Visible to group members for pickups and driving routes.")}
            </p>
          </div>
          <MapPin size={22} />
        </div>
        <div className="household-address-list">
          {schedule.households.map((household) => (
            <HouseholdAddressRow
              key={household.id}
              household={household}
              canManage={canManage}
              busy={Boolean(mutation.busyKey)}
              onSave={(next) =>
                mutation.mutate(
                  "households",
                  "PATCH",
                  { householdId: household.id, ...next },
                  `household-${household.id}`,
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Drive counts")}</h2>
            <p className="text-muted">
              {t("One count per active assigned ride.")}
            </p>
          </div>
          <Users size={22} />
        </div>
        {counts.map(({ household, count }) => (
          <div className="drive-count-row" key={household.id}>
            <span>{household.name}</span>
            <strong>{t("{{count}} rides", { count })}</strong>
          </div>
        ))}
      </section>
      {mutation.error && <p className="auth-error">{mutation.error}</p>}
      {mutation.message && <p className="auth-message">{mutation.message}</p>}
    </>
  );
}

function VenueRow({
  location,
  canManage,
  busy,
  onShare,
  onSave,
}: {
  location: GroupSchedule["locations"][number];
  canManage: boolean;
  busy: boolean;
  onShare: () => Promise<boolean>;
  onSave: (name: string, location: AddressValue) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState(location.name);
  const [draft, setDraft] = useState<AddressValue>({
    address: location.address,
    latitude: location.latitude,
    longitude: location.longitude,
  });

  function openInMaps() {
    const provider = savedNavigationProvider(
      window.localStorage.getItem(navigationProviderKey),
    );
    window.open(
      placeUrl(provider, {
        label: location.name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
      navigationTarget(),
      "noopener,noreferrer",
    );
  }

  if (editing) {
    return (
      <form
        className="household-address-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await onSave(name, draft)) setEditing(false);
        }}
      >
        <input
          className="input"
          required
          maxLength={160}
          value={name}
          aria-label={t("Venue name")}
          onChange={(event) => setName(event.target.value)}
        />
        <AddressInput
          required
          value={draft}
          onChange={setDraft}
          ariaLabel={t("Address for {{name}}", { name: location.name })}
        />
        <button className="primary-button" disabled={busy}>
          {t("Save")}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setName(location.name);
            setDraft({
              address: location.address,
              latitude: location.latitude,
              longitude: location.longitude,
            });
            setEditing(false);
          }}
        >
          {t("Cancel")}
        </button>
      </form>
    );
  }

  return (
    <div className="household-address-row">
      <div>
        <strong>{location.name}</strong>
        <address>{location.address}</address>
      </div>
      <span className="row-actions">
        <button className="text-button" type="button" onClick={openInMaps}>
          <MapPin size={16} />
          {t("Open in maps")}
        </button>
        {canManage && (
          <>
            <button
              className="text-button"
              type="button"
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} />
              {t("Edit")}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={sharing}
              onClick={async () => {
                setSharing(true);
                await onShare();
                setSharing(false);
              }}
            >
              <Share2 size={16} />
              {sharing ? t("Sharing…") : t("Share")}
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function HouseholdAddressRow({
  household,
  canManage,
  busy,
  onSave,
}: {
  household: GroupSchedule["households"][number];
  canManage: boolean;
  busy: boolean;
  onSave: (location: AddressValue) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AddressValue>({
    address: household.address,
    latitude: household.latitude,
    longitude: household.longitude,
  });

  return (
    <div className="household-address-row">
      <div>
        <strong>{household.name}</strong>
        <address>{household.address || t("No address added")}</address>
      </div>
      {canManage &&
        (editing ? (
          <form
            className="household-address-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onSave(draft)) setEditing(false);
            }}
          >
            <AddressInput
              required
              value={draft}
              onChange={setDraft}
              ariaLabel={t("Address for {{name}}", {
                name: household.name,
              })}
            />
            <button className="primary-button" disabled={busy}>
              {t("Save")}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setDraft({
                  address: household.address,
                  latitude: household.latitude,
                  longitude: household.longitude,
                });
                setEditing(false);
              }}
            >
              {t("Cancel")}
            </button>
          </form>
        ) : (
          <button
            className="text-button"
            type="button"
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} />
            {household.address ? t("Edit address") : t("Add address")}
          </button>
        ))}
    </div>
  );
}

type EventFields = {
  date: string;
  startTime: string;
  endTime: string | null;
  locationId: string;
  needsTo: boolean;
  needsFrom: boolean;
  eventType: EventType;
  title: string;
};

function EventForm({
  schedule,
  event,
  busy,
  onCancel,
  onSave,
}: {
  schedule: GroupSchedule;
  event: GroupEvent | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (fields: EventFields) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(
    event?.date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState(event?.startTime ?? "17:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [locationId, setLocationId] = useState(
    event?.locationId ?? schedule.locations[0]?.id ?? "",
  );
  const [eventType, setEventType] = useState<EventType>(
    event?.eventType ?? "practice",
  );
  const [title, setTitle] = useState(event?.title ?? "");
  const [needsTo, setNeedsTo] = useState(event?.needsTo ?? false);
  const [needsFrom, setNeedsFrom] = useState(event?.needsFrom ?? true);

  return (
    <form
      className="schedule-form"
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        onSave({
          date,
          startTime,
          endTime: endTime || null,
          locationId,
          needsTo,
          needsFrom,
          eventType,
          title,
        });
      }}
    >
      <label>
        {t("Event type")}
        <select
          className="input"
          value={eventType}
          onChange={(input) => setEventType(input.target.value as EventType)}
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {t(eventTypeLabel(type))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Optional event name")}
        <input
          className="input"
          maxLength={120}
          value={title}
          onChange={(input) => setTitle(input.target.value)}
          placeholder={t("Weekly Scouts meeting")}
        />
      </label>
      <label>
        {t("Date")}
        <input
          className="input"
          type="date"
          required
          value={date}
          onChange={(input) => setDate(input.target.value)}
        />
      </label>
      <label>
        {t("Start time")}
        <input
          className="input"
          type="time"
          required
          value={startTime}
          onChange={(input) => setStartTime(input.target.value)}
        />
      </label>
      <label>
        {t("End time")}
        <input
          className="input"
          type="time"
          value={endTime}
          onChange={(input) => setEndTime(input.target.value)}
        />
      </label>
      <label>
        {t("Venue")}
        <select
          className="input"
          required
          value={locationId}
          onChange={(input) => setLocationId(input.target.value)}
        >
          <option value="">{t("Choose a venue")}</option>
          {schedule.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={needsTo}
          onChange={(input) => setNeedsTo(input.target.checked)}
        />
        {t("Ride there")}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={needsFrom}
          onChange={(input) => setNeedsFrom(input.target.checked)}
        />
        {t("Ride home")}
      </label>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function RecurringForm({
  schedule,
  busy,
  onCancel,
  onSave,
}: {
  schedule: GroupSchedule;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [weekday, setWeekday] = useState(1);
  const [startsOn, setStartsOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endsOn, setEndsOn] = useState(
    format(addMonths(new Date(), 3), "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [locationId, setLocationId] = useState(
    schedule.locations[0]?.id ?? "",
  );
  const [needsTo, setNeedsTo] = useState(false);
  const [needsFrom, setNeedsFrom] = useState(true);
  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <form
      className="schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          weekday,
          startsOn,
          endsOn,
          startTime,
          endTime: endTime || null,
          locationId,
          needsTo,
          needsFrom,
          title: title.trim() || null,
        });
      }}
    >
      <label>
        {t("Event name")}
        <input
          className="input"
          required
          maxLength={120}
          value={title}
          onChange={(input) => setTitle(input.target.value)}
          placeholder={t("Weekly Scouts meeting")}
        />
      </label>
      <label>
        {t("Weekday")}
        <select
          className="input"
          value={weekday}
          onChange={(input) => setWeekday(Number(input.target.value))}
        >
          {weekdays.map((day, index) => (
            <option key={day} value={index + 1}>
              {t(day)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("From")}
        <input
          className="input"
          type="date"
          value={startsOn}
          onChange={(input) => setStartsOn(input.target.value)}
        />
      </label>
      <label>
        {t("Through")}
        <input
          className="input"
          type="date"
          min={startsOn}
          value={endsOn}
          onChange={(input) => setEndsOn(input.target.value)}
        />
      </label>
      <label>
        {t("Start time")}
        <input
          className="input"
          type="time"
          value={startTime}
          onChange={(input) => setStartTime(input.target.value)}
        />
      </label>
      <label>
        {t("End time")}
        <input
          className="input"
          type="time"
          value={endTime}
          onChange={(input) => setEndTime(input.target.value)}
        />
      </label>
      <label>
        {t("Venue")}
        <select
          className="input"
          required
          value={locationId}
          onChange={(input) => setLocationId(input.target.value)}
        >
          <option value="">{t("Choose a venue")}</option>
          {schedule.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={needsTo}
          onChange={(input) => setNeedsTo(input.target.checked)}
        />
        {t("Ride there")}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={needsFrom}
          onChange={(input) => setNeedsFrom(input.target.checked)}
        />
        {t("Ride home")}
      </label>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function VenueForm({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [location, setLocation] = useState<AddressValue>({
    address: "",
    latitude: null,
    longitude: null,
  });
  return (
    <form
      className="schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, ...location });
      }}
    >
      <label>
        {t("Venue name")}
        <input
          className="input"
          required
          value={name}
          onChange={(input) => setName(input.target.value)}
        />
      </label>
      <AddressInput
        label={t("Address")}
        required
        value={location}
        onChange={setLocation}
        placeholder={t("Start typing an address")}
      />
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function BreakForm({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endsOn, setEndsOn] = useState(format(new Date(), "yyyy-MM-dd"));
  return (
    <form
      className="schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ label, startsOn, endsOn });
      }}
    >
      <label>
        {t("Label (optional)")}
        <input
          className="input"
          value={label}
          placeholder={t("Winter break")}
          onChange={(input) => setLabel(input.target.value)}
        />
      </label>
      <label>
        {t("From")}
        <input
          className="input"
          type="date"
          value={startsOn}
          onChange={(input) => setStartsOn(input.target.value)}
        />
      </label>
      <label>
        {t("Through")}
        <input
          className="input"
          type="date"
          min={startsOn}
          value={endsOn}
          onChange={(input) => setEndsOn(input.target.value)}
        />
      </label>
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function FormActions({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="confirmation-actions">
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={onCancel}
      >
        {t("Cancel")}
      </button>
      <button className="primary-button" disabled={busy}>
        {busy ? t("Saving…") : t("Save")}
      </button>
    </div>
  );
}
