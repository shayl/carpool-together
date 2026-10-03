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
  ImagePlus,
  Check,
  ChevronDown,
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
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  isOwnHousehold,
  participantsInGroup,
  requiredLegs,
  rideState,
} from "@/lib/schedule-state";
import { AddressInput, type AddressValue } from "@/components/address-input";
import { MemberAvatar } from "@/components/member-avatar";
import { ActionMenu } from "@/components/action-menu";
import { Sheet } from "@/components/sheet";
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
import { ScheduleRefreshButton } from "@/components/pull-to-refresh";
import { useI18n } from "@/lib/i18n";
import type { AppFamily, AppGroup, AppRosterEntry } from "@/lib/app-data";
import { useAppTransport } from "@/lib/app-transport";
import {
  eligibleCurrentDriver,
  matchesRideFilter,
  namedRideDriver,
  nextUpcomingEvent,
  sortedEvents,
  weekEventsForDisplay,
  type RideFilter,
} from "@/lib/schedule-ui";
import { teamSectionFromParams, type TeamSection } from "@/lib/ui-navigation";
import {
  calendarCursorDate,
  navigationStateFromSearchParams,
  type NavigationState,
} from "@/lib/navigation-state";

type ScheduleView = "rides" | "family" | "groups";

type Props = {
  groupId: string;
  groupName: string;
  canManage: boolean;
  view: ScheduleView;
  schedule: GroupSchedule;
  /** Every group the viewer belongs to, for the all-groups rides view. */
  groups: AppGroup[];
  /** The account's shared family, reused by every group. */
  family: AppFamily | null;
  roster: AppRosterEntry[];
  uploadingImage?: string;
  onMemberPhoto?: (rosterEntryId: string, image: File) => void;
  onMemberPhotoRemove?: (rosterEntryId: string) => void;
  onPromote?: (rosterEntryId: string, role: string) => void;
  currentRosterEntryId?: string | null;
  offline?: boolean;
  initialNavigation: NavigationState;
  onNavigate?: (view: ScheduleView) => void;
  peopleActions?: ReactNode;
};

const eventTypes: EventType[] = ["practice", "game", "competition"];

function displayDate(date: Date, pattern: string, locale: "en" | "he") {
  return format(date, pattern, {
    locale: locale === "he" ? hebrewLocale : enUS,
  });
}

// Stored times are "HH:mm:ss"; the minutes are precise enough to read.
function displayTime(time: string) {
  return time.slice(0, 5);
}

function useCurrentTime(initialDate: string) {
  const [now, setNow] = useState(() => parseISO(initialDate));
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
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
  return <GroupsSchedule {...props} />;
}

function useMutation(groupId: string, offline = false) {
  const router = useRouter();
  const transport = useAppTransport();
  const { t } = useI18n();
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // The rides view shows events from every group at once, so a mutation
  // belongs to the event it came from rather than to one active group.
  // Group-scoped views omit the override and keep using the hook's group.
  async function mutate(
    resource: GroupScheduleResource,
    method: string,
    body: unknown,
    key: string,
    overrideGroupId?: string,
  ) {
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      if (offline || !navigator.onLine) {
        throw new Error(t("Reconnect to make changes."));
      }
      const response = await transport.request(groupResourceUrl(overrideGroupId ?? groupId, resource), {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      await readResult(response);
      setMessage(transport.preview ? t("Demo updated. Changes last until you reload.") : method === "DELETE" ? t("Removed.") : t("Saved."));
      if (!transport.preview) router.refresh();
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

  // Same reporting and refresh as mutate(), for endpoints addressed by a full
  // URL rather than a group resource name.
  async function request(
    url: string,
    method: string,
    body: unknown,
    key: string,
  ) {
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      if (offline || !navigator.onLine) {
        throw new Error(t("Reconnect to make changes."));
      }
      const response = await transport.request(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      await readResult(response);
      setMessage(transport.preview ? t("Demo updated. Changes last until you reload.") : method === "DELETE" ? t("Removed.") : t("Saved."));
      if (!transport.preview) router.refresh();
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

  return { busyKey, error, message, mutate, request };
}

function RidesSchedule({
  groupId,
  groupName,
  schedule,
  groups,
  roster,
  currentRosterEntryId,
  offline,
  initialNavigation,
}: Props) {
  const { t, locale } = useI18n();
  const mutation = useMutation(groupId, offline);
  const [display, setDisplay] = useState<"week" | "month">(
    initialNavigation.calendarDisplay,
  );
  const [cursor, setCursor] = useState(() =>
    parseISO(calendarCursorDate(initialNavigation.calendarDate, initialNavigation.calendarDisplay)),
  );
  const [filter, setFilter] = useState<RideFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const weekEnd = addDays(cursor, 6);
  const activeEvents = sortedEvents(schedule.events).filter(
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
  const filteredEvents = visibleEvents.filter((event) =>
    matchesRideFilter(schedule, event, filter),
  );
  const now = useCurrentTime(initialNavigation.currentDate);
  const weekEvents = weekEventsForDisplay(filteredEvents, format(cursor, "yyyy-MM-dd"), now);
  const coverageEvents = display === "week"
    ? weekEventsForDisplay(visibleEvents, format(cursor, "yyyy-MM-dd"), now).primary
    : visibleEvents;
  const rides = coverageEvents.flatMap((event) =>
    requiredLegs(event).map((leg) => rideState(schedule, event, leg)).filter((ride) => ride.active),
  );
  const open = rides.filter((ride) => ride.open).length;
  const nextEvent = nextUpcomingEvent(schedule, now);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", display);
    url.searchParams.set("date", format(cursor, "yyyy-MM-dd"));
    window.history.replaceState(null, "", url);
  }, [cursor, display]);

  useEffect(() => {
    const restoreCalendar = () => {
      const navigation = navigationStateFromSearchParams(
        new URL(window.location.href).searchParams,
      );
      setDisplay(navigation.calendarDisplay);
      setCursor(parseISO(calendarCursorDate(navigation.calendarDate, navigation.calendarDisplay)));
    };
    window.addEventListener("popstate", restoreCalendar);
    return () => window.removeEventListener("popstate", restoreCalendar);
  }, []);

  function move(direction: -1 | 1) {
    setCursor((current) =>
      display === "week"
        ? addDays(current, direction * 7)
        : addMonths(current, direction),
    );
  }

  function toggleDisplay() {
    setDisplay(display === "week" ? "month" : "week");
    if (display === "month") setCursor(startOfWeek(cursor, { weekStartsOn: 1 }));
    setFilter("all");
  }

  // Several groups share this list, so each card says which group it is for
  // and its roster comes from that group rather than the selected one.
  const eventGroups = new Map(groups.map((item) => [item.id, item]));
  const showGroupLabels = groups.length > 1;

  function renderEvent(event: GroupEvent) {
    const eventGroup = eventGroups.get(event.groupId);
    return <EventCard
      key={`${event.groupId}-${event.id}`} event={event} schedule={schedule}
      groupLabel={showGroupLabels ? eventGroup?.name : undefined}
      roster={eventGroup?.roster ?? roster}
      today={format(now, "yyyy-MM-dd")}
      currentRosterEntryId={eventGroup?.currentRosterEntryId ?? currentRosterEntryId}
      nextUp={nextEvent?.id === event.id}
      expanded={expanded === event.id}
      onToggle={() => setExpanded((current) => current === event.id ? null : event.id)}
      mutation={mutation}
    />;
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
          `${t(legKey(leg))}: ${!ride.active ? t("No rides needed") : namedRideDriver(schedule, roster, event, leg) ?? t("OPEN")}`,
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
    <div data-submitting={Boolean(mutation.busyKey)}>
      <div className="screen-heading screen-heading-row">
        <h1>{t("Rides")}</h1>
        <ScheduleRefreshButton />
      </div>
      <section className="schedule-toolbar">
        <div className="schedule-navigation">
          <button className="icon-button" type="button" aria-label={t("Previous")} onClick={() => move(-1)}><ChevronLeft size={20} /></button>
          <button
            className="date-range-button"
            type="button"
            onClick={toggleDisplay}
            aria-label={t(display === "week" ? "Open month view" : "Open week view")}
          >
            <CalendarDays size={18} />
            {display === "week"
              ? `${displayDate(cursor, "MMM d", locale)} – ${displayDate(weekEnd, "MMM d", locale)}`
              : displayDate(cursor, "MMMM yyyy", locale)}
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
        <ActionMenu label={t("Calendar options")} actions={[
          { label: t(display === "week" ? "Month view" : "Week view"), onSelect: toggleDisplay, icon: <CalendarDays size={18} /> },
          { label: t("Today"), onSelect: () => {
            setCursor(startOfWeek(new Date(), { weekStartsOn: 1 }));
            setDisplay("week");
            setFilter("all");
          } },
        ]} />
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
                      ? "Needs a driver"
                      : "We're driving",
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
      {mutation.message && <p className="auth-message" role="status">{mutation.message}</p>}

      {display === "month" ? (
        <MonthGrid
          cursor={cursor}
          events={filteredEvents}
          schedule={schedule}
          roster={roster}
          locale={locale}
          onOpen={(id) => {
            const event = schedule.events.find((item) => item.id === id);
            if (!event) return;
            setCursor(
              startOfWeek(parseISO(event.date), { weekStartsOn: 1 }),
            );
            setDisplay("week");
            setFilter("all");
            setExpanded(id);
          }}
        />
      ) : filteredEvents.length ? (
        <section className="weekly-events-card">
          {weekEvents.primary.map(renderEvent)}
          {weekEvents.earlier.length > 0 && <details className="earlier-events">
            <summary>{t("Earlier this week")} <span>{weekEvents.earlier.length}</span></summary>
            <div className="earlier-events-list">{weekEvents.earlier.map(renderEvent)}</div>
          </details>}
        </section>
      ) : (
        <section className="surface-card">
          <RideStatusCar status="neutral" />
          <h2>{t(visibleEvents.length ? "No rides match this filter" : "A quiet week")}</h2>
          <p className="text-muted">
            {t(visibleEvents.length ? "Try All to see the full schedule." : "Events will appear here when your group adds them.")}
          </p>
          {filter !== "all" && <button className="secondary-button" type="button" onClick={() => setFilter("all")}>{t("All")}</button>}
        </section>
      )}
    </div>
  );
}

function MonthGrid({
  cursor,
  events,
  schedule,
  roster,
  locale,
  onOpen,
}: {
  cursor: Date;
  events: GroupEvent[];
  schedule: GroupSchedule;
  roster: AppRosterEntry[];
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
                {dayEvents.map((event) => {
                  const drivers = [...new Set(requiredLegs(event).map((leg) => namedRideDriver(schedule, roster, event, leg)).filter(Boolean))];
                  return (
                    <button
                      key={event.id}
                      className={`month-event month-event-${coverageMood(eventCoverage(schedule, event))}`}
                      type="button"
                      onClick={() => onOpen(event.id)}
                    >
                      <strong>{displayTime(event.startTime)}</strong>
                      <span>{t(eventTitle(event))}</span>
                      {drivers.length > 0 && (
                        <span className="month-event-driver">
                          {drivers.join(" · ")}
                        </span>
                      )}
                    </button>
                  );
                })}
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
  groupLabel,
  schedule,
  roster,
  currentRosterEntryId,
  today,
  nextUp,
  expanded,
  onToggle,
  mutation,
}: {
  event: GroupEvent;
  /** Set only when the list spans several groups. */
  groupLabel?: string;
  schedule: GroupSchedule;
  roster: AppRosterEntry[];
  currentRosterEntryId?: string | null;
  today: string;
  nextUp: boolean;
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
  const mood = coverageMood(coverage);
  const detailsId = useId();
  const header = useRef<HTMLButtonElement>(null);
  const ownParticipants = participantsInGroup(schedule, event).filter(
    (participant) => isOwnHousehold(schedule, participant.householdId),
  );
  const [changingPlans, setChangingPlans] = useState(false);

  return (
    <article className={`weekly-event weekly-event-${mood}${nextUp ? " weekly-event-next" : ""}`}>
      {nextUp && <p className="next-up-label">{t("Next up")}</p>}
      <button
        ref={header}
        type="button"
        className="weekly-event-summary"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
      >
        <span className="weekly-event-date">
          <strong>{event.date === today ? t("Today") : displayDate(parseISO(event.date), "EEE", locale)}</strong>
          <span>{displayDate(parseISO(event.date), "MMM d", locale)}</span>
        </span>
        <span className="weekly-event-name">
          <strong>{t(eventTitle(event))}</strong>
          <span className="event-time">{displayTime(event.startTime)}{event.endTime ? ` – ${displayTime(event.endTime)}` : ""}</span>
          {location && <span className="event-location"><MapPin size={14} />{location.name}</span>}
          {/* Only when several groups share the list, where the title alone
              does not say which group an event belongs to. */}
          {groupLabel && <span className="event-group-label">{groupLabel}</span>}
        </span>
        <span className="weekly-event-coverage">
          <RideStatusCar status={coverage} />
          <span className="sr-only">{t(coverage === "covered" ? "All rides covered" : coverage === "open" ? "Needs a driver" : "No carpool needed")}</span>
        </span>
        <ChevronDown
          className={
            expanded ? "event-disclosure-chevron event-disclosure-chevron-expanded" : "event-disclosure-chevron"
          }
          size={20}
        />
      </button>
      <div id={detailsId} className="weekly-event-details" hidden={!expanded}>
        {expanded && <>
          <div className="event-card-actions">
            {ownParticipants.length > 0 && <button type="button" className="text-button" onClick={() => {
              if (ownParticipants.length === 1) setSelectedParticipantId(ownParticipants[0].id);
              else setChangingPlans(true);
            }}><Users size={16} aria-hidden="true" />{t("Change plans")}</button>}
            <button className="text-button event-hide-details" type="button" onClick={() => {
              onToggle();
              header.current?.focus();
            }}>
              {t("Hide details")}
              <ChevronDown size={16} className="event-disclosure-chevron-expanded" aria-hidden="true" />
            </button>
          </div>
          <div className="member-avatar-row" aria-label={t("Member ride status")}>
            {participantsInGroup(schedule, event).map((participant) => {
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
              roster={roster}
              currentRosterEntryId={currentRosterEntryId}
              mutation={mutation}
            />
          ))}
        </>}
      </div>
      {changingPlans && <Sheet title={t("Change plans")} onClose={() => setChangingPlans(false)}>
        <p className="text-muted">{t(eventTitle(event))} · {event.date} · {event.startTime}</p>
        <div className="settings-link-card">
          {ownParticipants.map((participant) => <button type="button" key={participant.id} onClick={() => {
            setChangingPlans(false);
            setSelectedParticipantId(participant.id);
          }}><MemberAvatar name={participant.name} size={40} /><span>{participant.name}</span><ChevronRight size={18} /></button>)}
        </div>
      </Sheet>}
      {selectedParticipant && (
        <ParticipantStatusEditor
          key={`${event.id}-${selectedParticipant.id}`}
          event={event}
          participant={selectedParticipant}
          schedule={schedule}
          mutation={mutation}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}
    </article>
  );
}

function DriverPicker({ event, leg, roster, mutation, onClose }: {
  event: GroupEvent;
  leg: RideLeg;
  roster: AppRosterEntry[];
  mutation: ReturnType<typeof useMutation>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [driverId, setDriverId] = useState("");
  const drivers = roster.filter((member) => member.active && member.householdId);
  return <Sheet title={t("Choose a driver")} busy={Boolean(mutation.busyKey)} onClose={onClose}>
    <form className="schedule-form" onSubmit={async (input) => {
      input.preventDefault();
      const saved = await mutation.mutate("claims", "POST", {
        eventId: event.id, leg, driverRosterEntryId: driverId,
      }, `claim-${event.id}-${leg}`, event.groupId);
      if (saved) onClose();
    }}>
      <p>{t(legKey(leg))} · {t(eventTitle(event))} · {event.date}</p>
      <label>{t("Driver")}<select className="input" required value={driverId} onChange={(input) => setDriverId(input.target.value)}>
        <option value="">{t("Choose a driver")}</option>
        {drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.displayName}</option>)}
      </select></label>
      {!drivers.length && <p className="text-muted">{t("Add an adult to a household before assigning a driver.")}</p>}
      {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
      <button className="primary-button" disabled={!driverId || Boolean(mutation.busyKey)}>{t(mutation.busyKey ? "Saving…" : "Assign driver")}</button>
    </form>
  </Sheet>;
}

function RideLegPanel({
  event,
  leg,
  schedule,
  roster,
  currentRosterEntryId,
  mutation,
}: {
  event: GroupEvent;
  leg: RideLeg;
  schedule: GroupSchedule;
  roster: AppRosterEntry[];
  currentRosterEntryId?: string | null;
  mutation: ReturnType<typeof useMutation>;
}) {
  const { t } = useI18n();
  const ride = rideState(schedule, event, leg);
  const currentDriver = eligibleCurrentDriver(roster, currentRosterEntryId);
  const [choosingDriver, setChoosingDriver] = useState(false);
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
            {roster.find(
              (member) => member.id === ride.claim?.driverRosterEntryId,
            )?.displayName ??
              ride.household?.name ??
              t("Assigned family")}
          </strong>
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(mutation.busyKey)}
            onClick={() => {
              if (!window.confirm(t("Release {{direction}} driven by {{name}}? The ride will need a driver.", {
                direction: t(legKey(leg)),
                name: namedRideDriver(schedule, roster, event, leg) ?? t("Assigned family"),
              }))) return;
              void mutation.mutate(
                "claims",
                "DELETE",
                { eventId: event.id, leg },
                `release-${event.id}-${leg}`,
                event.groupId,
              );
            }}
          >
            {t("Release ride")}
          </button>
        </div>
      ) : (
        <div className="claim-row">
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(mutation.busyKey)}
            onClick={() => currentDriver
              ? void mutation.mutate(
                "claims",
                "POST",
                { eventId: event.id, leg, driverRosterEntryId: currentDriver.id },
                `claim-${event.id}-${leg}`,
                event.groupId,
              ) : setChoosingDriver(true)
            }
          >
            {t(currentDriver ? "I'll drive" : "Choose a driver")}
          </button>
          {currentDriver && <button className="text-button" type="button" onClick={() => setChoosingDriver(true)}>{t("Choose another driver")}</button>}
        </div>
      )}
      {ride.claim && <p className="text-muted">{t("To change the driver, release this ride, then choose another driver.")}</p>}
      {choosingDriver && <DriverPicker event={event} leg={leg} roster={roster} mutation={mutation} onClose={() => setChoosingDriver(false)} />}
      <details className="pickup-details">
        <summary>{t("Riders & pickup addresses")} · {ride.participants.length}</summary>
      <p className="rider-list">
        {ride.participants.map((participant) => participant.name).join(", ")}
      </p>
      <div className="ride-address-list">
        {ride.household && (
          <address>
            <strong>
              {t("Driver: {{name}}", {
                name:
                  roster.find(
                    (member) => member.id === ride.claim?.driverRosterEntryId,
                  )?.displayName ?? ride.household.name,
              })}
            </strong>
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
      </details>
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
  const transport = useAppTransport();
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
    const response = await transport.request(`/api/groups/${groupId}/routes`, {
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
        disabled={busy || transport.preview}
        onClick={() => void openRoute()}
      >
        <Route size={17} />
        {busy ? t("Preparing route…") : t("Navigate")}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={busy || transport.preview}
        onClick={() => void openRoute(true)}
      >
        {t("Change maps app")}
      </button>
      {error && <p className="auth-error">{error}</p>}
      {transport.preview && <p className="preview-note">{t("Navigation is disabled for demo addresses.")}</p>}
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
  const { t, locale } = useI18n();
  const attendance = effectiveAttendance(schedule, event, participant);
  const [draft, setDraft] = useState(attendance);
  const dirty = draft.absent !== attendance.absent ||
    draft.optOutTo !== attendance.optOutTo || draft.optOutFrom !== attendance.optOutFrom;

  return (
    <Sheet title={t("Ride status for {{name}}", { name: participant.name })} busy={Boolean(mutation.busyKey)} onClose={onClose}>
      <form className="schedule-form plans-form" data-dirty={dirty} onSubmit={async (input) => {
        input.preventDefault();
        const saved = await mutation.mutate("attendance", "PUT", {
          eventId: event.id, participantId: participant.id,
          absent: draft.absent, optOutTo: draft.optOutTo, optOutFrom: draft.optOutFrom,
        }, `attendance-${event.id}-${participant.id}`, event.groupId);
        if (saved) onClose();
      }}>
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
        </div>
        <p className="text-muted">{t(eventTitle(event))} · {displayDate(parseISO(event.date), "EEE, MMM d", locale)} · {event.startTime}</p>
        <label className="status-choice">
          <input
            type="checkbox"
            checked={draft.absent}
            disabled={Boolean(mutation.busyKey)}
            onChange={(input) => setDraft({ ...draft, absent: input.target.checked })}
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
              checked={!draft.optOutTo && !draft.absent}
              disabled={draft.absent || Boolean(mutation.busyKey)}
              onChange={(input) => setDraft({ ...draft, optOutTo: !input.target.checked })}
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
              checked={!draft.optOutFrom && !draft.absent}
              disabled={draft.absent || Boolean(mutation.busyKey)}
              onChange={(input) => setDraft({ ...draft, optOutFrom: !input.target.checked })}
            />
            <span>
              <strong>{t("Needs ride home")}</strong>
              <small>{t("Include this member in the return ride")}</small>
            </span>
          </label>
        )}
        {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
        <button className="primary-button" disabled={Boolean(mutation.busyKey) || !dirty}>
          {t(mutation.busyKey ? "Saving…" : "Save plans")}
        </button>
      </form>
    </Sheet>
  );
}

function FamilySchedule({
  groupId,
  schedule,
  roster,
  currentRosterEntryId,
  offline,
  initialNavigation,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const transport = useAppTransport();
  const mutation = useMutation(groupId, offline);
  const household = schedule.households.find(
    (item) => item.id === schedule.currentHouseholdId,
  );
  const participants = schedule.participants.filter(
    (item) => item.householdId === household?.id,
  );
  const drivers = roster.filter(
    (member) => member.active && member.householdId === household?.id,
  );
  const [showAbsence, setShowAbsence] = useState(false);
  const [showPastAbsences, setShowPastAbsences] = useState(false);
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [showFamilyDetails, setShowFamilyDetails] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [familyError, setFamilyError] = useState("");
  const [dailyPlan, setDailyPlan] = useState<{ event: GroupEvent; participant: GroupSchedule["participants"][number] } | null>(null);
  const familyEditButton = useRef<HTMLButtonElement>(null);
  const [startsOn, setStartsOn] = useState(initialNavigation.currentDate);
  const [endsOn, setEndsOn] = useState(initialNavigation.currentDate);
  const [selected, setSelected] = useState<string[]>(
    participants.map((item) => item.id),
  );
  const today = initialNavigation.currentDate;
  const familyWeekStart = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  const familyWeekEnd = addDays(familyWeekStart, 6);
  const familyEvents = sortedEvents(schedule.events)
    .filter(
      (event) =>
        event.date >= format(familyWeekStart, "yyyy-MM-dd") &&
        event.date <= format(familyWeekEnd, "yyyy-MM-dd") &&
        !isEventInBreak(schedule, event),
    );
  const familyAbsences = [
    ...schedule.absencePeriods
      .filter((period) =>
        participants.some((item) => item.id === period.participantId),
      )
      .reduce(
        (groups, period) => {
          const current = groups.get(period.periodGroupId);
          if (current) {
            current.participantIds.push(period.participantId);
          } else {
            groups.set(period.periodGroupId, {
              periodGroupId: period.periodGroupId,
              startsOn: period.startsOn,
              endsOn: period.endsOn,
              participantIds: [period.participantId],
            });
          }
          return groups;
        },
        new Map<
          string,
          {
            periodGroupId: string;
            startsOn: string;
            endsOn: string;
            participantIds: string[];
          }
        >(),
      )
      .values(),
  ].filter((period) => showPastAbsences || period.endsOn >= today);

  async function saveFamilyDetails(input: FamilyDetailsInput) {
    setSavingFamily(true);
    setFamilyError("");
    try {
      if (offline || !navigator.onLine) {
        throw new Error(t("Reconnect to make changes."));
      }
      const response = await transport.request(
        `/api/groups/${groupId}/households/family`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      await readResult(response);
      setShowFamilyDetails(false);
      if (!transport.preview) router.refresh();
      return true;
    } catch (caught) {
      setFamilyError(
        caught instanceof Error ? t(caught.message) : t("Change failed."),
      );
      return false;
    } finally {
      setSavingFamily(false);
    }
  }

  return (
    <div data-submitting={Boolean(mutation.busyKey) || savingFamily}>
      <div className="screen-heading">
        <h1>{t("My family")}</h1>
        <p>{t("Your riders, your plans.")}</p>
      </div>
      {household && (
        <section className="surface-card family-overview-card">
          <h2>{t("{{name}} family", { name: household.name })}</h2>
          {participants.length === 0 && (
            <div className="family-empty-state">
              <Users size={24} />
              <div>
                <strong>{t("No riders in this family yet")}</strong>
                <p>{t("Use Edit family details to add the first rider.")}</p>
              </div>
            </div>
          )}
          {participants.map((participant) => (
            <div className="family-rider" key={participant.id}>
              <MemberAvatar
                name={participant.name}
                photoUrl={participant.photoUrl}
                size={48}
              />
              <div className="family-rider-content">
                <h3>{participant.name}</h3>
                <p className="text-muted">
                  {t("Week of {{date}}", {
                    date: displayDate(familyWeekStart, "MMM d", locale),
                  })}
                </p>
                <div className="family-event-list">
                  {familyEvents.map((event) => {
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
                      <button className="family-event-row" type="button" key={event.id} onClick={() => setDailyPlan({ event, participant })}>
                        <time dateTime={event.date}>
                          {displayDate(
                            parseISO(event.date),
                            "EEE, MMM d",
                            locale,
                          )}
                        </time>
                        <strong>{t(eventTitle(event))} · {event.startTime}</strong>
                        <span>
                          {attendance.absent
                            ? t("Not attending")
                            : open
                              ? t("{{count}} rides need a driver", {
                                  count: open,
                                })
                              : needed.length
                                ? t("Covered")
                                : t("No rides needed")}
                        </span>
                        <small>{t("Change plans")} <ChevronRight size={14} /></small>
                      </button>
                    );
                  })}
                </div>
                {!familyEvents.length && <p className="text-muted">{t("No events this week. Your family plans are up to date.")}</p>}
              </div>
            </div>
          ))}
        </section>
      )}
      {dailyPlan && <ParticipantStatusEditor
        key={`${dailyPlan.event.id}-${dailyPlan.participant.id}`}
        event={dailyPlan.event} participant={dailyPlan.participant}
        schedule={schedule} mutation={mutation} onClose={() => setDailyPlan(null)}
      />}
      <section className="surface-card family-section family-absence-card">
        <div>
          <h2>{t("Rider absences")}</h2>
          <p className="text-muted">
            {t(
              "Applies to scheduled events. Only your family can change these dates.",
            )}
          </p>
        </div>
        <div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setEditingAbsenceId(null);
              setSelected(participants.map((participant) => participant.id));
              setStartsOn(today);
              setEndsOn(today);
              setShowAbsence((value) => !value);
            }}
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
                editingAbsenceId ? "PATCH" : "POST",
                {
                  startsOn,
                  endsOn,
                  participantIds: selected,
                  ...(editingAbsenceId && {
                    periodGroupId: editingAbsenceId,
                  }),
                },
                "add-absence",
              );
              if (saved) {
                setShowAbsence(false);
                setEditingAbsenceId(null);
              }
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
              disabled={transport.preview || Boolean(mutation.busyKey) || !selected.length || endsOn < startsOn}
            >
              {t("Save absence")}
            </button>
          </form>
        )}
        {familyAbsences.map((period) => (
            <div className="period-row" key={period.periodGroupId}>
              <span>
                {participants
                  .filter((participant) =>
                    period.participantIds.includes(participant.id),
                  )
                  .map((participant) => participant.name)
                  .join(", ")}
              </span>
              <span>
                {period.startsOn} – {period.endsOn}
              </span>
              <span className="row-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setEditingAbsenceId(period.periodGroupId);
                    setSelected(period.participantIds);
                    setStartsOn(period.startsOn);
                    setEndsOn(period.endsOn);
                    setShowAbsence(true);
                  }}
                >
                  {t("Edit")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={transport.preview || Boolean(mutation.busyKey)}
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
              </span>
            </div>
          ))}
        <button
          className="text-button family-past-toggle"
          type="button"
          onClick={() => setShowPastAbsences((value) => !value)}
        >
          {t(showPastAbsences ? "Hide past dates" : "Show past dates")}
        </button>
      </section>
      {household && (
        <section className="surface-card family-section family-details-card">
          <div>
            <h2>{t("Family details")}</h2>
            <p className="text-muted">{household.address}</p>
          </div>
          <button
            ref={familyEditButton}
            className="text-button family-details-toggle"
            type="button"
            onClick={() => {
              setFamilyError("");
              setShowFamilyDetails(true);
            }}
          >
            {t("Edit family details")}
          </button>
          {showFamilyDetails && (
            <Sheet
              title={t("Edit family details")}
              busy={savingFamily}
              returnFocus={familyEditButton}
              onClose={() => setShowFamilyDetails(false)}
            >
              <FamilyEditForm
                household={household}
                guardians={drivers}
                riders={participants}
                currentRosterEntryId={currentRosterEntryId}
                busy={savingFamily}
                error={familyError}
                onSubmit={saveFamilyDetails}
              />
            </Sheet>
          )}
        </section>
      )}
      {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
      {mutation.message && <p className="auth-message" role="status">{mutation.message}</p>}
    </div>
  );
}

type FamilyDetailsInput = {
  householdId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  guardians: Array<{ id?: string; name: string; phone: string }>;
  riders: Array<{ id?: string; name: string }>;
};

function FamilyEditForm({
  household,
  guardians: initialGuardians,
  riders: initialRiders,
  currentRosterEntryId,
  busy,
  error,
  onSubmit,
}: {
  household: GroupSchedule["households"][number];
  guardians: AppRosterEntry[];
  riders: GroupSchedule["participants"];
  currentRosterEntryId?: string | null;
  busy: boolean;
  error: string;
  onSubmit: (input: FamilyDetailsInput) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const { preview } = useAppTransport();
  const [name, setName] = useState(household.name);
  const [address, setAddress] = useState<AddressValue>({
    address: household.address,
    latitude: household.latitude,
    longitude: household.longitude,
  });
  const [guardians, setGuardians] = useState<
    Array<{ id?: string; name: string; phone: string }>
  >(() =>
    initialGuardians.map((guardian) => ({
      id: guardian.id,
      name: guardian.displayName,
      phone: guardian.phone ?? "",
    })),
  );
  const [riders, setRiders] = useState<
    Array<{ id?: string; name: string }>
  >(() =>
    initialRiders.map((rider) => ({ id: rider.id, name: rider.name })),
  );

  return (
    <form
      className="family-edit-form"
      onChangeCapture={(event) => {
        event.currentTarget.dataset.dirty = "true";
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          householdId: household.id,
          name,
          address: address.address,
          latitude: address.latitude,
          longitude: address.longitude,
          guardians,
          riders,
        });
      }}
    >
      <div className="family-edit-basics">
        <label>
          <span>{t("Family name")}</span>
          <input
            className="input"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Family name")}
          />
        </label>
        <AddressInput
          label={t("Address")}
          required
          value={address}
          onChange={setAddress}
          placeholder={t("123 Main St, City")}
        />
      </div>

      <div className="family-edit-members">
        {guardians.map((guardian, index) => {
          const protectedGuardian =
            guardian.id === currentRosterEntryId ||
            guardian.id === household.rosterEntryId;
          return (
            <div
              className="family-edit-member-row"
              key={guardian.id ?? `guardian-${index}`}
            >
              <label>
                <span>{t("Parent / guardian")}</span>
                <input
                  className="input"
                  required
                  maxLength={100}
                  value={guardian.name}
                  onChange={(event) =>
                    setGuardians((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <span>{t("Phone")}</span>
                <input
                  className="input"
                  required
                  inputMode="tel"
                  value={guardian.phone}
                  onChange={(event) =>
                    setGuardians((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, phone: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="family-remove-button"
                type="button"
                disabled={protectedGuardian}
                title={
                  protectedGuardian
                    ? t("This guardian is required for your active account.")
                    : t("Remove guardian")
                }
                onClick={() =>
                  setGuardians((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                {t("Remove")}
              </button>
            </div>
          );
        })}
        {riders.map((rider, index) => (
          <div
            className="family-edit-member-row family-edit-rider-row"
            key={rider.id ?? `rider-${index}`}
          >
            <label>
              <span>{t("Rider")}</span>
              <input
                className="input"
                required
                maxLength={100}
                value={rider.name}
                onChange={(event) =>
                  setRiders((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <button
              className="family-remove-button"
              type="button"
              onClick={() =>
                setRiders((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              {t("Remove")}
            </button>
          </div>
        ))}
      </div>

      <div className="family-add-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            setGuardians((current) => [
              ...current,
              { name: "", phone: "" },
            ])
          }
        >
          {t("+ Guardian")}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            setRiders((current) => [...current, { name: "" }])
          }
        >
          {t("+ Rider")}
        </button>
      </div>
      <button
        className="primary-button family-save-button"
        disabled={preview || busy || !guardians.length}
      >
        {busy ? t("Saving…") : t("Save family changes")}
      </button>
      {preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}

function GroupsSchedule({
  groupId,
  canManage,
  schedule,
  roster,
  uploadingImage,
  onMemberPhoto,
  onMemberPhotoRemove,
  onPromote,
  offline,
  initialNavigation,
  peopleActions,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const transport = useAppTransport();
  const mutation = useMutation(groupId, offline);
  const [section, setSection] = useState<TeamSection>(initialNavigation.venueToken ? "places" : "schedule");
  const [panel, setPanel] = useState<
    "add" | "event" | "recurring" | "venue" | "break" | null
  >(null);
  const [editingEvent, setEditingEvent] = useState<GroupEvent | null>(null);
  const [editingBreak, setEditingBreak] = useState<
    GroupSchedule["breaks"][number] | null
  >(null);
  const [shareLink, setShareLink] = useState("");
  const [importToken, setImportToken] = useState(initialNavigation.venueToken);
  const [editingHousehold, setEditingHousehold] = useState<string | null>(null);
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [householdError, setHouseholdError] = useState("");
  const counts = driveCounts(schedule);
  useEffect(() => {
    const restore = () => setSection(teamSectionFromParams(new URL(window.location.href).searchParams));
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function openSection(next: TeamSection) {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("team", next);
    window.history.pushState(null, "", url);
  }

  async function removeMember(rosterEntryId: string, name: string) {
    if (
      !window.confirm(
        t("Remove {{name}} from the group? Their past rides are kept.", {
          name,
        }),
      )
    ) {
      return;
    }
    const removed = await mutation.request(
      `/api/groups/${groupId}/roster/${rosterEntryId}`,
      "DELETE",
      undefined,
      `remove-${rosterEntryId}`,
    );
    if (!removed) return;
    // Someone added by mistake, with no rides to their name, can be deleted
    // outright so the list does not keep a removed row forever.
    if (
      window.confirm(
        t("Also delete {{name}} permanently? This cannot be undone.", { name }),
      )
    ) {
      await mutation.request(
        `/api/groups/${groupId}/roster/${rosterEntryId}?purge=1`,
        "DELETE",
        undefined,
        `purge-${rosterEntryId}`,
      );
    }
  }

  async function saveHouseholdDetails(input: FamilyDetailsInput) {
    setSavingHousehold(true);
    setHouseholdError("");
    try {
      if (offline || !navigator.onLine) {
        throw new Error(t("Reconnect to make changes."));
      }
      const response = await transport.request(
        `/api/groups/${groupId}/households/family`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      await readResult(response);
      setEditingHousehold(null);
      if (!transport.preview) router.refresh();
      return true;
    } catch (caught) {
      setHouseholdError(
        caught instanceof Error ? t(caught.message) : t("Change failed."),
      );
      return false;
    } finally {
      setSavingHousehold(false);
    }
  }

  async function shareVenue(locationId: string) {
    setShareLink("");
    const response = await transport.request(`/api/groups/${groupId}/venue-shares`, {
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
    <div data-submitting={Boolean(mutation.busyKey) || savingHousehold}>
      <div className="screen-heading">
        <h1>{t("Team")}</h1>
        <p>{t("Small tasks. Shared effort.")}</p>
      </div>
      <nav className="task-navigation" aria-label={t("Team tasks")}>
        {([
          ["schedule", "Schedule", CalendarDays],
          ["people", "People", Users],
          ["places", "Places", MapPin],
          ["balance", "Driving balance", Car],
        ] as const).map(([id, label, Icon]) => <button type="button" key={id} aria-current={section === id ? "page" : undefined} onClick={() => openSection(id)}><Icon size={18} /><span>{t(label)}</span></button>)}
      </nav>
      {section === "schedule" && (
      <>
        <section className="surface-card">
          <div className="card-heading">
            <div>
              <h2>{t("Event schedule")}</h2>
              <p className="text-muted">
                {t("Add one-time events or recurring weekly events.")}
              </p>
            </div>
          </div>
          {canManage && <div className="schedule-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setPanel("add");
              }}
            >
              <Plus size={18} />
              {t("Add event")}
            </button>
          </div>}
          {panel === "add" && canManage && <Sheet title={t("Add event")} onClose={() => setPanel(null)}>
            <p className="text-muted">{t("How often does your group meet?")}</p>
            <div className="settings-link-card">
              <button type="button" onClick={() => setPanel("event")}><Plus size={22} /><span><strong>{t("One-time event")}</strong><small>{t("A single date for your group.")}</small></span><ChevronRight size={18} /></button>
              <button type="button" onClick={() => setPanel("recurring")}><CalendarDays size={22} /><span><strong>{t("Recurring weekly events")}</strong><small>{t("Repeat on the same day each week.")}</small></span><ChevronRight size={18} /></button>
            </div>
          </Sheet>}
          {panel === "event" && canManage && (
            <Sheet title={t(editingEvent ? "Edit event" : "One-time event")} busy={Boolean(mutation.busyKey)} onClose={() => setPanel(null)}>
            <EventForm
              key={editingEvent?.id ?? "new-event"}
              groupId={groupId}
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
            {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
            </Sheet>
          )}
          {panel === "recurring" && canManage && (
            <Sheet title={t("Recurring weekly events")} busy={Boolean(mutation.busyKey)} onClose={() => setPanel(null)}>
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
            {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
            </Sheet>
          )}
          <div className="manage-event-list">
            {sortedEvents(schedule.events).filter((event) => event.date >= initialNavigation.currentDate).map((event) => (
              <div className="period-row" key={event.id}>
                <span>
                  <strong>{t(eventTitle(event))}</strong>
                  <small>{event.date} · {event.startTime}</small>
                </span>
                {canManage && <span className="row-actions">
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
                    disabled={transport.preview || Boolean(mutation.busyKey)}
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
                </span>}
              </div>
            ))}
            {!schedule.events.some((event) => event.date >= initialNavigation.currentDate) && <p className="text-muted">{t("No upcoming events. Add the next date when you're ready.")}</p>}
          </div>
        </section>
      </>
      )}
      {section === "places" && (
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Venues")}</h2>
            <p className="text-muted">
              {t("Places your events meet. Open one to see it on a map.")}
            </p>
          </div>
          {canManage && <button className="primary-button" type="button" onClick={() => setPanel("venue")}><Plus size={18} />{t("Add venue")}</button>}
        </div>
        {panel === "venue" && canManage && <Sheet title={t("Add venue")} busy={Boolean(mutation.busyKey)} onClose={() => setPanel(null)}>
          <VenueForm busy={Boolean(mutation.busyKey)} onCancel={() => setPanel(null)} onSave={async (body) => {
            if (await mutation.mutate("locations", "POST", body, "save-location")) setPanel(null);
          }} />
          {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
        </Sheet>}
        {schedule.locations.length === 0 ? (
          <p className="text-muted">{t("No venues yet.")}</p>
        ) : (
          <div className="household-address-list">
            {schedule.locations.map((location) => (
              <VenueRow
                key={location.id}
                location={location}
                canManage={canManage && !transport.preview}
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
                transport.preview || mutation.busyKey === "import-venue" || !importToken.trim()
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
      )}
      {section === "schedule" && (
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
            onClick={() => {
              setEditingBreak(null);
              setPanel(panel === "break" ? null : "break");
            }}
          >
            <Plus size={18} />
            {t("Add break")}
          </button>
        </div>
        {panel === "break" && (
          <Sheet title={t(editingBreak ? "Edit break" : "Add break")} busy={Boolean(mutation.busyKey)} onClose={() => setPanel(null)}>
          <BreakForm
            key={editingBreak?.id ?? "new-break"}
            period={editingBreak}
            busy={Boolean(mutation.busyKey)}
            onCancel={() => {
              setPanel(null);
              setEditingBreak(null);
            }}
            onSave={async (body) => {
              const saved = await mutation.mutate(
                "breaks",
                editingBreak ? "PATCH" : "POST",
                editingBreak ? { ...body, id: editingBreak.id } : body,
                "save-break",
              );
              if (saved) {
                setPanel(null);
                setEditingBreak(null);
              }
            }}
          />
          {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
          </Sheet>
        )}
        {schedule.breaks.map((period) => (
          <div className="period-row" key={period.id}>
            <span>
              <strong>{period.label || t("Group break")}</strong>
              <small>
                {period.startsOn} – {period.endsOn}
              </small>
            </span>
            <span className="row-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setEditingBreak(period);
                  setPanel("break");
                }}
              >
                {t("Edit")}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={transport.preview || Boolean(mutation.busyKey)}
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
            </span>
          </div>
        ))}
      </section>
      )}
      {section === "people" && (
      <section className="surface-card">
        <div className="card-heading">
          <div>
            <h2>{t("Households")}</h2>
            <p className="text-muted">
              {t(
                "Your people, their families, and pickup details.",
              )}
            </p>
          </div>
          {peopleActions ?? <Users size={22} />}
        </div>
        <div className="household-list">
          {counts.map(({ household, count }) => (
            <HouseholdRow
              key={household.id}
              household={household}
              members={roster.filter(
                (member) =>
                  member.active && member.householdId === household.id,
              )}
              riders={schedule.participants.filter(
                (rider) => rider.householdId === household.id,
              )}
              driveCount={count}
              canManage={canManage}
              otherHouseholds={schedule.households.filter(
                (option) => option.id !== household.id,
              )}
              busy={transport.preview || Boolean(mutation.busyKey)}
              uploadingImage={uploadingImage}
              onMemberPhoto={onMemberPhoto}
              onMemberPhotoRemove={onMemberPhotoRemove}
              onPromote={onPromote}
              onEdit={() => setEditingHousehold(household.id)}
              onJoin={(rosterEntryId, householdId) =>
                void mutation.mutate(
                  "households/membership",
                  "PATCH",
                  { rosterEntryId, householdId },
                  `join-${rosterEntryId}`,
                )
              }
              onLeave={(rosterEntryId) =>
                void mutation.mutate(
                  "households/membership",
                  "PATCH",
                  { rosterEntryId, householdId: null },
                  `leave-${rosterEntryId}`,
                )
              }
              onRemove={(rosterEntryId, name) =>
                void removeMember(rosterEntryId, name)
              }
            />
          ))}
        </div>
      </section>
      )}
      {section === "balance" && <section className="surface-card">
        <h2>{t("Driving balance")}</h2>
        <p className="text-muted">{t("Each direction counts as one drive. Share the effort over time.")}</p>
        {counts.map(({ household, count }) => <div className="balance-row" key={household.id}><span>{household.name}</span><strong>{t("{{count}} drives", { count })}</strong></div>)}
        {!counts.length && <p className="text-muted">{t("Driving totals will appear when families join.")}</p>}
      </section>}
      {transport.preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
      {editingHousehold &&
        (() => {
          const target = schedule.households.find(
            (item) => item.id === editingHousehold,
          );
          if (!target) return null;
          return (
            <Sheet
              title={t("Edit family details")}
              busy={savingHousehold}
              onClose={() => setEditingHousehold(null)}
            >
              <FamilyEditForm
                household={target}
                guardians={roster.filter(
                  (member) => member.active && member.householdId === target.id,
                )}
                riders={schedule.participants.filter(
                  (rider) => rider.householdId === target.id,
                )}
                busy={savingHousehold}
                error={householdError}
                onSubmit={saveHouseholdDetails}
              />
            </Sheet>
          );
        })()}
      {mutation.error && <p className="auth-error" role="alert">{mutation.error}</p>}
      {mutation.message && <p className="auth-message" role="status">{mutation.message}</p>}
    </div>
  );
}

function HouseholdRow({
  household,
  members,
  riders,
  driveCount,
  canManage,
  otherHouseholds,
  busy,
  uploadingImage,
  onMemberPhoto,
  onMemberPhotoRemove,
  onPromote,
  onEdit,
  onJoin,
  onLeave,
  onRemove,
}: {
  household: GroupSchedule["households"][number];
  members: AppRosterEntry[];
  riders: GroupSchedule["participants"];
  driveCount: number;
  canManage: boolean;
  otherHouseholds: GroupSchedule["households"];
  busy: boolean;
  uploadingImage?: string;
  onMemberPhoto?: (rosterEntryId: string, image: File) => void;
  onMemberPhotoRemove?: (rosterEntryId: string) => void;
  onPromote?: (rosterEntryId: string, role: string) => void;
  onEdit: () => void;
  onJoin: (rosterEntryId: string, householdId: string) => void;
  onLeave: (rosterEntryId: string) => void;
  onRemove: (rosterEntryId: string, name: string) => void;
}) {
  const { t } = useI18n();
  // A household of one is really just a person who has not been grouped yet,
  // so offer to move them into an existing family from the same line.
  const single = members.length === 1;

  return (
    <div className="household-card">
      <div className="household-card-head">
        <div className="household-row-main">
          <strong>{household.name}</strong>
          <address>{household.address || t("No address added")}</address>
        </div>
        <div className="household-row-side">
          <span className="household-row-drives">
            {t("{{count}} rides", { count: driveCount })}
          </span>
          {canManage && (
            <button className="text-button" type="button" onClick={onEdit}>
              <Pencil size={16} />
              {t("Edit")}
            </button>
          )}
        </div>
      </div>
      {members.map((member) => (
        <div className="household-member" key={member.id}>
          <MemberAvatar
            name={member.displayName}
            photoUrl={member.photoUrl}
            size={36}
          />
          <div className="household-member-name">
            <strong>{member.displayName}</strong>
            <span>{member.phone ?? t("Phone hidden")}</span>
          </div>
          {(member.role === "admin" || member.role === "owner") && (
            <small className="household-member-role">{t(member.role)}</small>
          )}
          {canManage && (
            <>
              <label
                className="icon-button member-photo-button"
                title={member.photoUrl ? t("Change photo") : t("Add photo")}
              >
                <ImagePlus size={16} aria-hidden="true" />
                <span className="member-photo-label">
                  {uploadingImage === `member-${member.id}`
                    ? t("Uploading…")
                    : member.photoUrl
                      ? t("Change photo")
                      : t("Add photo")}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy || Boolean(uploadingImage) || !onMemberPhoto}
                  onChange={(event) => {
                    const image = event.target.files?.[0];
                    event.target.value = "";
                    if (image) onMemberPhoto?.(member.id, image);
                  }}
                />
              </label>
              <ActionMenu
                label={t("Actions for {{name}}", { name: member.displayName })}
                disabled={busy}
                actions={[
                  ...otherHouseholds.map((option) => ({
                    label: t("Join {{household}}", { household: option.name }),
                    disabled: !single,
                    onSelect: () => onJoin(member.id, option.id),
                  })),
                  {
                    label: t("Move out"),
                    disabled: single,
                    onSelect: () => onLeave(member.id),
                  },
                  {
                    label: t("Make organizer"),
                    disabled:
                      !onPromote ||
                      member.role === "admin" ||
                      member.role === "owner",
                    onSelect: () => {
                      if (
                        window.confirm(
                          t("Make {{name}} an organizer?", {
                            name: member.displayName,
                          }),
                        )
                      ) {
                        onPromote?.(member.id, "admin");
                      }
                    },
                  },
                  {
                    label: t("Remove photo"),
                    disabled: !member.photoUrl || !onMemberPhotoRemove,
                    onSelect: () => onMemberPhotoRemove?.(member.id),
                  },
                  {
                    label: t("Remove"),
                    danger: true,
                    onSelect: () => onRemove(member.id, member.displayName),
                  },
                ]}
              />
            </>
          )}
        </div>
      ))}
      {riders.length > 0 && (
        <p className="household-row-riders">
          {t("Riders")}: {riders.map((rider) => rider.name).join(", ")}
        </p>
      )}
    </div>
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
          mapKind="venue"
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
  groupId,
  schedule,
  event,
  busy,
  onCancel,
  onSave,
}: {
  groupId: string;
  schedule: GroupSchedule;
  event: GroupEvent | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (fields: EventFields) => void;
}) {
  const { t } = useI18n();
  const transport = useAppTransport();
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
  const [locations, setLocations] = useState(schedule.locations);
  const [addingVenue, setAddingVenue] = useState(false);
  const [venueBusy, setVenueBusy] = useState(false);
  const [venueError, setVenueError] = useState("");
  const venueTrigger = useRef<HTMLButtonElement>(null);

  async function saveVenue(body: Record<string, unknown>) {
    setVenueBusy(true);
    setVenueError("");
    try {
      if (!navigator.onLine) throw new Error(t("Reconnect to make changes."));
      const response = await transport.request(`/api/groups/${groupId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.id) {
        throw new Error(result?.error ?? t("Could not add the venue."));
      }
      const location = {
        id: result.id,
        groupId,
        name: String(body.name),
        address: String(body.address),
        latitude:
          typeof body.latitude === "number" ? body.latitude : null,
        longitude:
          typeof body.longitude === "number" ? body.longitude : null,
      };
      setLocations((current) => [...current, location]);
      setLocationId(location.id);
      setAddingVenue(false);
    } catch (caught) {
      setVenueError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not add the venue."),
      );
    } finally {
      setVenueBusy(false);
    }
  }

  return (
    <>
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
          onChange={(input) => {
            const nextType = input.target.value as EventType;
            setEventType(nextType);
            if (!event && nextType !== "practice") {
              setNeedsTo(true);
              setNeedsFrom(true);
            }
          }}
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
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <button
          ref={venueTrigger}
          className="text-button inline-add-venue"
          type="button"
          onClick={() => {
            setVenueError("");
            setAddingVenue(true);
          }}
        >
          <Plus size={16} />
          {t("Add venue")}
        </button>
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
      {addingVenue && (
        <Sheet
          title={t("Add venue")}
          busy={venueBusy}
          returnFocus={venueTrigger}
          onClose={() => setAddingVenue(false)}
        >
          <VenueForm
            busy={venueBusy}
            onCancel={() => setAddingVenue(false)}
            onSave={(body) => void saveVenue(body)}
          />
          {venueError && <p className="auth-error">{venueError}</p>}
        </Sheet>
      )}
    </>
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
        mapKind="venue"
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
  period,
  busy,
  onCancel,
  onSave,
}: {
  period?: GroupSchedule["breaks"][number] | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState(period?.label ?? "");
  const [startsOn, setStartsOn] = useState(
    period?.startsOn ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [endsOn, setEndsOn] = useState(
    period?.endsOn ?? format(new Date(), "yyyy-MM-dd"),
  );
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
  const { preview } = useAppTransport();
  return (
    <>
    {preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
    <div className="confirmation-actions">
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={onCancel}
      >
        {t("Cancel")}
      </button>
      <button className="primary-button" disabled={busy || preview}>
        {busy ? t("Saving…") : t("Save")}
      </button>
    </div>
    </>
  );
}
