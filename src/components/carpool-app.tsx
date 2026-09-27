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
  const groups = initialGroups;
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0].id);
  const [destination, setDestination] = useState<Destination>("rides");
  const [settingsPage, setSettingsPage] = useState<"about" | null>(null);
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

  async function importRoster() {
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter(([name, phone]) => Boolean(name && phone));

    if (rows.length === 0) {
      setError("Add at least one row in the format Name, Phone.");
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
        throw new Error(result.error ?? "Could not update the roster.");
      }

      setCsv("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not update the roster.",
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
        throw new Error(result.error ?? "Could not create the group.");
      }

      setNewGroupName("");
      setNewGroupPin("");
      if (result.groupId) setActiveGroupId(result.groupId);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create the group.",
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
        throw new Error("error" in result ? result.error : "Unable to plan rides.");
      }

      setPlan(result);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to plan rides.",
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
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-lockup">
            <div className="team-logo" aria-hidden="true">
              {group.shortName}
            </div>
            <div className="brand-copy">
              <p>{group.name} Carpool</p>
              <span>{memberName}</span>
            </div>
          </div>
          <div className="header-actions">
            <label className="group-switcher">
              <span className="sr-only">Active group</span>
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
              aria-label="Sign out"
              title="Sign out"
              disabled={signingOut}
              onClick={signOut}
            >
              <LogOut size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <nav className="app-navigation" aria-label="Main navigation">
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
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main id="main-content" tabIndex={-1} className="app-main">
        {destination === "rides" && (
          <>
            <div className="screen-heading">
              <h1>Rides</h1>
              <p>A little teamwork. Every ride.</p>
            </div>

            {!group.event ? (
              <section className="surface-card">
                <h2>No events scheduled</h2>
                <p className="text-muted">
                  Event and ride planning will appear here after an organizer
                  creates the group schedule.
                </p>
              </section>
            ) : (
              <>
            <section className="week-heading" aria-label="Week navigation">
              <button className="icon-button" type="button" aria-label="Previous week">
                ‹
              </button>
              <div>
                <strong>This week</strong>
                <span>Sep 21 – Sep 27</span>
              </div>
              <button className="icon-button" type="button" aria-label="Next week">
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
                    ? "Every ride has a seat"
                    : `${riders.length - coveredCount} rides need help`}
                </strong>
              </span>
              <span>
                {coveredCount} of {riders.length} covered
              </span>
            </div>

            <div className="ride-filters" aria-label="Ride filters">
              <button type="button" aria-pressed="true">
                All
              </button>
              <button type="button" aria-pressed="false">
                Needs a family
              </button>
              <button type="button" aria-pressed="false">
                My family
              </button>
            </div>

            <section className="weekly-events-card">
              <article className="weekly-event">
                <div className="weekly-event-summary">
                  <div className="weekly-event-date">
                    <strong>Thu 24</strong>
                    <span>5:30 PM</span>
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
                      {fullyCovered ? "Covered" : "Needs a driver"}
                    </span>
                  </div>
                  <ChevronDown className="weekly-event-chevron" size={20} />
                </div>

                <div className="weekly-event-details">
                  <div className="event-detail-heading">
                    <div>
                      <strong>Homeward ride</strong>
                      <span>
                        {riders.length} riders · {availableSeats} seats offered
                      </span>
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={generatePlan}
                      disabled={loading}
                    >
                      {loading ? "Planning…" : "Suggest carpools"}
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
                            {driver.seats === 1 ? "seat" : "seats"}
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
                          <strong>Suggested plan</strong>
                          <span>Draft until each driver accepts</span>
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
                              : "No pickup needed"}
                          </span>
                          <small>
                            +{trip.estimatedDetourMiles} mi estimated ·{" "}
                            {trip.seatsRemaining} seats left
                          </small>
                        </div>
                      ))}
                      {plan.unassigned.length > 0 && (
                        <p className="unassigned">
                          <strong>Still needs a seat:</strong>{" "}
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
              <h1>My family</h1>
              <p>Your riders, your plans.</p>
            </div>
            <section className="surface-card">
              <div className="family-member">
                <div className="person-avatar person-avatar-large">
                  {initials(group.participants[0]?.name ?? "Family")}
                </div>
                <div>
                  <strong>{group.participants[0]?.name ?? "No rider yet"}</strong>
                  <span>{group.participants[0]?.address}</span>
                </div>
              </div>
              <div className="ride-row">
                <div className="ride-row-main">
                  <div>
                    <strong>Thursday practice</strong>
                    <p className="text-muted">Homeward ride requested</p>
                  </div>
                  <span className="status-label status-covered">Covered</span>
                </div>
              </div>
            </section>
          </>
        )}

        {destination === "team" && (
          <>
            <div className="screen-heading">
              <h1>Team</h1>
              <p>The people who keep everyone moving.</p>
            </div>
            <section className="surface-card roster-card">
              <div className="card-heading">
                <h2>Group roster</h2>
                <span>{group.roster.length} people</span>
              </div>
              {group.roster.map((member) => (
                <div className="person-row" key={member.id}>
                  <div className="person-avatar">
                    {initials(member.displayName)}
                  </div>
                  <div>
                    <strong>{member.displayName}</strong>
                    <span>{member.phone ?? "Phone hidden"}</span>
                  </div>
                  <small>{member.role}</small>
                </div>
              ))}
            </section>

            {group.canManageRoster && (
              <>
            <h2 className="settings-section-title">Add members</h2>
            <section className="surface-card import-card">
              <div className="import-heading">
                <Upload size={22} aria-hidden="true" />
                <div>
                  <strong>Import selected people</strong>
                  <span>Paste name and phone, one per line.</span>
                </div>
              </div>
              <label>
                <span className="sr-only">Roster rows</span>
                <textarea
                  className="input roster-input"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  placeholder={"Alex Morgan, 425-555-0100\nSam Rivera, 425-555-0101"}
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={importRoster}
                disabled={loading}
              >
                {loading ? "Adding…" : "Add selected people"}
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
              Settings
            </button>
            <div className="screen-heading">
              <h1>About</h1>
              <p>Private groups. Smarter rides.</p>
            </div>

            <section className="surface-card about-card">
              <div className="about-heading">
                <Info size={24} aria-hidden="true" />
                <div>
                  <h2>Important notice</h2>
                  <p>Please understand the limits of this service.</p>
                </div>
              </div>
              <div className="legal-copy">
                <p>
                  Carpool Together is a coordination tool. It is not a
                  transportation provider, rideshare broker, employer, insurer,
                  background-check service, or emergency service.
                </p>
                <p>
                  The service does not verify drivers, vehicles, licenses,
                  insurance, child-restraint equipment, routes, schedules, or
                  safety. Users and group organizers decide whether to offer or
                  accept a ride and remain responsible for following applicable
                  laws and confirming that each ride is appropriate.
                </p>
                <p>
                  Route, timing, capacity, and carpool suggestions are estimates
                  for planning only. They are not guarantees. Do not rely on the
                  service for emergencies or time-critical transportation.
                </p>
                <p>
                  To the fullest extent permitted by applicable law, this proof
                  service is provided “as is” and “as available,” without
                  warranties. Use it at your own risk. Nothing in this notice
                  limits rights or responsibilities that cannot legally be
                  waived.
                </p>
              </div>
              <div className="legal-review-note">
                This notice is not legal advice or a replacement for complete
                Terms of Service and a Privacy Policy. Obtain review from a
                qualified attorney before a public launch.
              </div>
            </section>
          </>
        )}

        {destination === "settings" && settingsPage === null && (
          <>
            <div className="screen-heading">
              <h1>Settings</h1>
              <p>{group.name}</p>
            </div>
            <h2 className="settings-section-title">Active group</h2>
            <section className="settings-link-card">
              <button type="button">
                <Users size={22} aria-hidden="true" />
                <span>
                  <strong>Switch group</strong>
                  <small>
                    Your account belongs to {groups.length} private groups.
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button">
                <CalendarDays size={22} aria-hidden="true" />
                <span>
                  <strong>Group schedule</strong>
                  <small>{group.event ?? "No event scheduled"}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button">
                <ShieldCheck size={22} aria-hidden="true" />
                <span>
                  <strong>Privacy and consent</strong>
                  <small>Addresses stay private to authorized rides.</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" onClick={() => setSettingsPage("about")}>
                <Info size={22} aria-hidden="true" />
                <span>
                  <strong>About and important notice</strong>
                  <small>What this service does—and does not—provide.</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </section>

            <h2 className="settings-section-title">Create another group</h2>
            <section className="surface-card">
              <form className="auth-form" onSubmit={createGroup}>
                <label htmlFor="new-group-name">Group name</label>
                <div className="auth-input-wrap">
                  <input
                    id="new-group-name"
                    required
                    maxLength={100}
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="Neighborhood carpool"
                  />
                </div>
                <label htmlFor="new-group-pin">Shared group PIN</label>
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
                    placeholder="4 to 12 characters"
                  />
                </div>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Creating…" : "Create group"}
                </button>
              </form>
              {error && <p className="error">{error}</p>}
            </section>
          </>
        )}

        <footer className="app-version">Carpool Together</footer>
      </main>
    </div>
  );
}
