"use client";

import {
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronDown,
  Heart,
  Info,
  LogOut,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppGroup } from "@/lib/app-data";
import type { SuggestionPlan } from "@/lib/carpool";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";

type Destination = "rides" | "family" | "team" | "settings";

const destinations = [
  { id: "rides", label: "Rides", icon: Car },
  { id: "family", label: "My family", icon: Heart },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CarpoolApp({
  initialGroups,
  memberName,
}: {
  initialGroups: AppGroup[];
  memberName: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const groups = initialGroups;
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0].id);
  const [destination, setDestination] = useState<Destination>("rides");
  const [settingsPage, setSettingsPage] = useState<
    "about" | "groups" | null
  >(null);
  const [csv, setCsv] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupPin, setNewGroupPin] = useState("");
  const [plan, setPlan] = useState<SuggestionPlan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const group = useMemo(
    () => groups.find((item) => item.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );
  const participantById = useMemo(
    () =>
      new Map(
        group.participants.map((participant) => [
          participant.id,
          participant,
        ]),
      ),
    [group.participants],
  );
  const riders = group.participants.filter((participant) => participant.needsRide);
  const availableSeats = group.drivers.reduce(
    (total, driver) => total + driver.seats,
    0,
  );
  const coveredCount = plan
    ? plan.trips.reduce((total, trip) => total + trip.riderIds.length, 0)
    : Math.min(riders.length, availableSeats);
  const fullyCovered = riders.length > 0 && coveredCount >= riders.length;

  function switchGroup(groupId: string) {
    setActiveGroupId(groupId);
    setPlan(null);
    setError("");
    setDestination("rides");
    setSettingsPage(null);
  }

  function switchGroupFromSettings(groupId: string) {
    setActiveGroupId(groupId);
    setPlan(null);
    setError("");
    setSettingsPage(null);
  }

  function openGroupSchedule() {
    setDestination("rides");
    setSettingsPage(null);
    setError("");
  }

  async function importRoster() {
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter(([name, phone]) => Boolean(name && phone));

    if (rows.length === 0) {
      setError(t("Add at least one row in the format Name, Phone."));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/groups/${group.id}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: rows.map(([displayName, phone]) => ({
            displayName,
            phone,
            role: "member",
          })),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error
            ? t(result.error)
            : t("Could not update the roster."),
        );
      }

      setCsv("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not update the roster."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName, pin: newGroupPin }),
      });
      const result = (await response.json()) as {
        error?: string;
        groupId?: string;
      };
      if (!response.ok) {
        throw new Error(
          result.error
            ? t(result.error)
            : t("Could not create the group."),
        );
      }

      setNewGroupName("");
      setNewGroupPin("");
      if (result.groupId) setActiveGroupId(result.groupId);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not create the group."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function generatePlan() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          destination: group.destination,
          participants: group.participants,
          drivers: group.drivers,
        }),
      });
      const result: SuggestionPlan | { error: string } = await response.json();

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? t(result.error)
            : t("Unable to plan rides."),
        );
      }

      setPlan(result);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("Unable to plan rides."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }

    router.refresh();
  }

  return (
    <div
      className="app-shell"
      style={{ "--team": group.accent } as React.CSSProperties}
    >
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-lockup">
            <div className="team-logo" aria-hidden="true">
              {group.shortName}
            </div>
            <div className="brand-copy">
              <p>{t("{{group}} Carpool", { group: group.name })}</p>
              <span>{memberName}</span>
            </div>
          </div>
          <div className="header-actions">
            <label className="group-switcher">
              <span className="sr-only">{t("Active group")}</span>
              <select
                value={activeGroupId}
                onChange={(event) => switchGroup(event.target.value)}
              >
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={t("Sign out")}
              title={t("Sign out")}
              disabled={signingOut}
              onClick={signOut}
            >
              <LogOut size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <nav className="app-navigation" aria-label={t("Main navigation")}>
        {destinations.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={destination === id ? "page" : undefined}
            onClick={() => {
              setDestination(id);
              setSettingsPage(null);
              setError("");
            }}
            className={
              destination === id ? "nav-item nav-item-active" : "nav-item"
            }
          >
            <Icon size={21} aria-hidden="true" />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>

      <main id="main-content" tabIndex={-1} className="app-main">
        {destination === "rides" && (
          <>
            <div className="screen-heading">
              <h1>{t("Rides")}</h1>
              <p>{t("A little teamwork. Every ride.")}</p>
            </div>

            {!group.event ? (
              <section className="surface-card">
                <h2>{t("No events scheduled")}</h2>
                <p className="text-muted">
                  {t(
                    "Event and ride planning will appear here after an organizer creates the group schedule.",
                  )}
                </p>
              </section>
            ) : (
              <>
            <section className="week-heading" aria-label={t("Week navigation")}>
              <button className="icon-button" type="button" aria-label={t("Previous week")}>
                ‹
              </button>
              <div>
                <strong>{t("This week")}</strong>
                <span>{t("Sep 21 – Sep 27")}</span>
              </div>
              <button className="icon-button" type="button" aria-label={t("Next week")}>
                ›
              </button>
            </section>

            <div
              className={
                fullyCovered ? "coverage-bar" : "coverage-bar coverage-open"
              }
            >
              <span>
                <strong>
                  {fullyCovered
                    ? t("Every ride has a seat")
                    : t("{{count}} rides need help", {
                        count: riders.length - coveredCount,
                      })}
                </strong>
              </span>
              <span>
                {t("{{covered}} of {{total}} covered", {
                  covered: coveredCount,
                  total: riders.length,
                })}
              </span>
            </div>

            <div className="ride-filters" aria-label={t("Ride filters")}>
              <button type="button" aria-pressed="true">
                {t("All")}
              </button>
              <button type="button" aria-pressed="false">
                {t("Needs a family")}
              </button>
              <button type="button" aria-pressed="false">
                {t("My family")}
              </button>
            </div>

            <section className="weekly-events-card">
              <article className="weekly-event">
                <div className="weekly-event-summary">
                  <div className="weekly-event-date">
                    <strong>{t("Thu 24")}</strong>
                    <span>{t("5:30 PM")}</span>
                  </div>
                  <div className="weekly-event-name">
                    <strong>{group.event.split(" at ")[0]}</strong>
                    <span>{group.event.split(" at ")[1]}</span>
                  </div>
                  <div className="weekly-event-coverage">
                    <Car
                      className={
                        fullyCovered
                          ? "ride-status-car ride-status-car-happy"
                          : "ride-status-car ride-status-car-sad"
                      }
                      aria-hidden="true"
                    />
                    <span>
                      {fullyCovered ? t("Covered") : t("Needs a driver")}
                    </span>
                  </div>
                  <ChevronDown className="weekly-event-chevron" size={20} />
                </div>

                <div className="weekly-event-details">
                  <div className="event-detail-heading">
                    <div>
                      <strong>{t("Homeward ride")}</strong>
                      <span>
                        {t("{{riders}} riders · {{seats}} seats offered", {
                          riders: riders.length,
                          seats: availableSeats,
                        })}
                      </span>
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={generatePlan}
                      disabled={loading}
                    >
                      {loading ? t("Planning…") : t("Suggest carpools")}
                    </button>
                  </div>

                  <div className="driver-list">
                    {group.drivers.map((driver) => (
                      <div className="driver-row" key={driver.id}>
                        <div className="person-avatar">{initials(driver.name)}</div>
                        <div>
                          <strong>{driver.name}</strong>
                          <span>
                            {driver.address} · {driver.seats}{" "}
                            {driver.seats === 1 ? t("seat") : t("seats")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {plan && (
                    <div className="suggestion-result">
                      <div className="suggestion-title">
                        <ShieldCheck size={19} aria-hidden="true" />
                        <div>
                          <strong>{t("Suggested plan")}</strong>
                          <span>{t("Draft until each driver accepts")}</span>
                        </div>
                      </div>
                      {plan.trips.map((trip) => (
                        <div className="suggested-trip" key={trip.driverId}>
                          <strong>{trip.driverName}</strong>
                          <span>
                            {trip.riderIds.length
                              ? trip.riderIds
                                  .map(
                                    (id) =>
                                      participantById.get(id)?.name ?? id,
                                  )
                                  .join(", ")
                              : t("No pickup needed")}
                          </span>
                          <small>
                            {t(
                              "+{{miles}} mi estimated · {{seats}} seats left",
                              {
                                miles: trip.estimatedDetourMiles,
                                seats: trip.seatsRemaining,
                              },
                            )}
                          </small>
                        </div>
                      ))}
                      {plan.unassigned.length > 0 && (
                        <p className="unassigned">
                          <strong>{t("Still needs a seat:")}</strong>{" "}
                          {plan.unassigned
                            .map(
                              (item) =>
                                participantById.get(item.participantId)?.name ??
                                item.participantId,
                            )
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  {error && <p className="error">{error}</p>}
                </div>
              </article>
            </section>
              </>
            )}
          </>
        )}

        {destination === "family" && (
          <>
            <div className="screen-heading">
              <h1>{t("My family")}</h1>
              <p>{t("Your riders, your plans.")}</p>
            </div>
            <section className="surface-card">
              <div className="family-member">
                <div className="person-avatar person-avatar-large">
                  {initials(group.participants[0]?.name ?? t("Family"))}
                </div>
                <div>
                  <strong>
                    {group.participants[0]?.name ?? t("No rider yet")}
                  </strong>
                  <span>{group.participants[0]?.address}</span>
                </div>
              </div>
              <div className="ride-row">
                <div className="ride-row-main">
                  <div>
                    <strong>{t("Thursday practice")}</strong>
                    <p className="text-muted">
                      {t("Homeward ride requested")}
                    </p>
                  </div>
                  <span className="status-label status-covered">
                    {t("Covered")}
                  </span>
                </div>
              </div>
            </section>
          </>
        )}

        {destination === "team" && (
          <>
            <div className="screen-heading">
              <h1>{t("Team")}</h1>
              <p>{t("The people who keep everyone moving.")}</p>
            </div>
            <section className="surface-card roster-card">
              <div className="card-heading">
                <h2>{t("Group roster")}</h2>
                <span>
                  {t("{{count}} people", { count: group.roster.length })}
                </span>
              </div>
              {group.roster.map((member) => (
                <div className="person-row" key={member.id}>
                  <div className="person-avatar">
                    {initials(member.displayName)}
                  </div>
                  <div>
                    <strong>{member.displayName}</strong>
                    <span>{member.phone ?? t("Phone hidden")}</span>
                  </div>
                  <small>{t(member.role)}</small>
                </div>
              ))}
            </section>

            {group.canManageRoster && (
              <>
            <h2 className="settings-section-title">{t("Add members")}</h2>
            <section className="surface-card import-card">
              <div className="import-heading">
                <Upload size={22} aria-hidden="true" />
                <div>
                  <strong>{t("Import selected people")}</strong>
                  <span>{t("Paste name and phone, one per line.")}</span>
                </div>
              </div>
              <label>
                <span className="sr-only">{t("Roster rows")}</span>
                <textarea
                  className="input roster-input"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  placeholder={`${t("Alex Morgan")}, 425-555-0100\nSam Rivera, 425-555-0101`}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={importRoster}
                disabled={loading}
              >
                {loading ? t("Adding…") : t("Add selected people")}
              </button>
              {error && <p className="error">{error}</p>}
            </section>
              </>
            )}
          </>
        )}

        {destination === "settings" && settingsPage === "about" && (
          <>
            <button
              className="text-button back-button"
              type="button"
              onClick={() => setSettingsPage(null)}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              {t("Settings")}
            </button>
            <div className="screen-heading">
              <h1>{t("About")}</h1>
              <p>{t("Private groups. Smarter rides.")}</p>
            </div>

            <section className="surface-card about-card">
              <div className="about-heading">
                <Info size={24} aria-hidden="true" />
                <div>
                  <h2>{t("Important notice")}</h2>
                  <p>{t("Please understand the limits of this service.")}</p>
                </div>
              </div>
              <div className="legal-copy">
                <p>
                  {t(
                    "Carpool Together is a coordination tool. It is not a transportation provider, rideshare broker, employer, insurer, background-check service, or emergency service.",
                  )}
                </p>
                <p>
                  {t(
                    "The service does not verify drivers, vehicles, licenses, insurance, child-restraint equipment, routes, schedules, or safety. Users and group organizers decide whether to offer or accept a ride and remain responsible for following applicable laws and confirming that each ride is appropriate.",
                  )}
                </p>
                <p>
                  {t(
                    "Route, timing, capacity, and carpool suggestions are estimates for planning only. They are not guarantees. Do not rely on the service for emergencies or time-critical transportation.",
                  )}
                </p>
                <p>
                  {t(
                    "To the fullest extent permitted by applicable law, this proof service is provided “as is” and “as available,” without warranties. Use it at your own risk. Nothing in this notice limits rights or responsibilities that cannot legally be waived.",
                  )}
                </p>
              </div>
              <div className="legal-review-note">
                {t(
                  "This notice is not legal advice or a replacement for complete Terms of Service and a Privacy Policy. Obtain review from a qualified attorney before a public launch.",
                )}
              </div>
            </section>
          </>
        )}

        {destination === "settings" && settingsPage === "groups" && (
          <>
            <button
              className="text-button back-button"
              type="button"
              onClick={() => setSettingsPage(null)}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              {t("Settings")}
            </button>
            <div className="screen-heading">
              <h1>{t("Switch group")}</h1>
              <p>{t("Choose the group you want to manage.")}</p>
            </div>
            <section
              className="settings-link-card"
              aria-label={t("Your groups")}
            >
              {groups.map((item) => {
                const isCurrent = item.id === activeGroupId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => switchGroupFromSettings(item.id)}
                  >
                    <span className="settings-group-logo" aria-hidden="true">
                      {item.shortName}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {isCurrent ? t("Current group") : t("Open this group")}
                      </small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                );
              })}
            </section>
          </>
        )}

        {destination === "settings" && settingsPage === null && (
          <>
            <div className="screen-heading">
              <h1>{t("Settings")}</h1>
              <p>{group.name}</p>
            </div>
            <h2 className="settings-section-title">{t("Active group")}</h2>
            <section className="settings-link-card">
              <button
                type="button"
                onClick={() => setSettingsPage("groups")}
              >
                <Users size={22} aria-hidden="true" />
                <span>
                  <strong>{t("Switch group")}</strong>
                  <small>
                    {t("Your account belongs to {{count}} private groups.", {
                      count: groups.length,
                    })}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" onClick={openGroupSchedule}>
                <CalendarDays size={22} aria-hidden="true" />
                <span>
                  <strong>{t("Group schedule")}</strong>
                  <small>{group.event ?? t("No event scheduled")}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" onClick={() => router.push("/privacy")}>
                <ShieldCheck size={22} aria-hidden="true" />
                <span>
                  <strong>{t("Privacy and consent")}</strong>
                  <small>
                    {t("Addresses stay private to authorized rides.")}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" onClick={() => setSettingsPage("about")}>
                <Info size={22} aria-hidden="true" />
                <span>
                  <strong>{t("About and important notice")}</strong>
                  <small>
                    {t("What this service does—and does not—provide.")}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </section>

            <h2 className="settings-section-title">
              {t("Create another group")}
            </h2>
            <section className="surface-card">
              <form className="auth-form" onSubmit={createGroup}>
                <label htmlFor="new-group-name">{t("Group name")}</label>
                <div className="auth-input-wrap">
                  <input
                    id="new-group-name"
                    required
                    maxLength={100}
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder={t("Neighborhood carpool")}
                  />
                </div>
                <label htmlFor="new-group-pin">{t("Shared group PIN")}</label>
                <div className="auth-input-wrap">
                  <input
                    id="new-group-pin"
                    required
                    type="password"
                    inputMode="numeric"
                    minLength={4}
                    maxLength={12}
                    value={newGroupPin}
                    onChange={(event) => setNewGroupPin(event.target.value)}
                    placeholder={t("4 to 12 characters")}
                  />
                </div>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? t("Creating…") : t("Create group")}
                </button>
              </form>
              {error && <p className="error">{error}</p>}
            </section>
          </>
        )}

        <footer className="app-version">
          Carpool Together · {t("Developed by")}{" "}
          <a href="https://github.com/shayl" rel="me">
            @shayl
          </a>
        </footer>
      </main>
    </div>
  );
}
