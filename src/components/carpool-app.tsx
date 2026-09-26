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
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Coordinate,
  DriverOffer,
  Participant,
  SuggestionPlan,
} from "@/lib/carpool";
import { createClient } from "@/lib/supabase/browser";

type Group = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  event: string;
  destination: Coordinate;
  participants: Participant[];
  drivers: DriverOffer[];
};

type Destination = "rides" | "family" | "team" | "settings";

const destinations = [
  { id: "rides", label: "Rides", icon: Car },
  { id: "family", label: "My family", icon: Heart },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const initialGroups: Group[] = [
  {
    id: "rainier-swim",
    name: "Rainier Swim Club",
    shortName: "RS",
    accent: "#5b4bdb",
    event: "Thursday practice at Medgar Evers Pool",
    destination: { lat: 47.612, lng: -122.304 },
    participants: [
      {
        id: "maya",
        groupId: "rainier-swim",
        name: "Maya Chen",
        address: "Greenwood meeting point",
        location: { lat: 47.69, lng: -122.355 },
        needsRide: true,
      },
      {
        id: "owen",
        groupId: "rainier-swim",
        name: "Owen Brooks",
        address: "Wallingford meeting point",
        location: { lat: 47.662, lng: -122.335 },
        needsRide: true,
      },
      {
        id: "lina",
        groupId: "rainier-swim",
        name: "Lina Patel",
        address: "Capitol Hill meeting point",
        location: { lat: 47.625, lng: -122.316 },
        needsRide: true,
      },
      {
        id: "theo",
        groupId: "rainier-swim",
        name: "Theo James",
        address: "Beacon Hill meeting point",
        location: { lat: 47.579, lng: -122.311 },
        needsRide: false,
      },
    ],
    drivers: [
      {
        id: "driver-alex",
        groupId: "rainier-swim",
        name: "Alex Morgan",
        address: "Greenwood",
        origin: { lat: 47.694, lng: -122.357 },
        seats: 2,
      },
      {
        id: "driver-sam",
        groupId: "rainier-swim",
        name: "Sam Rivera",
        address: "Beacon Hill",
        origin: { lat: 47.581, lng: -122.309 },
        seats: 1,
      },
    ],
  },
  {
    id: "wed-dancers",
    name: "Wednesday Dancers",
    shortName: "WD",
    accent: "#466f96",
    event: "Wednesday rehearsal at Fremont Studios",
    destination: { lat: 47.651, lng: -122.351 },
    participants: [
      {
        id: "nia",
        groupId: "wed-dancers",
        name: "Nia Williams",
        address: "Magnolia meeting point",
        location: { lat: 47.653, lng: -122.4 },
        needsRide: true,
      },
      {
        id: "ava",
        groupId: "wed-dancers",
        name: "Ava Kim",
        address: "Queen Anne meeting point",
        location: { lat: 47.637, lng: -122.365 },
        needsRide: true,
      },
    ],
    drivers: [
      {
        id: "driver-jordan",
        groupId: "wed-dancers",
        name: "Jordan Lee",
        address: "Queen Anne",
        origin: { lat: 47.638, lng: -122.366 },
        seats: 3,
      },
    ],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function coordinateFor(index: number, destination: Coordinate): Coordinate {
  const ring = Math.floor(index / 6) + 1;
  const angle = ((index % 6) * Math.PI) / 3;

  return {
    lat: destination.lat + Math.cos(angle) * 0.018 * ring,
    lng: destination.lng + Math.sin(angle) * 0.024 * ring,
  };
}

export function CarpoolApp({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0].id);
  const [destination, setDestination] = useState<Destination>("rides");
  const [settingsPage, setSettingsPage] = useState<"about" | null>(null);
  const [csv, setCsv] = useState(
    "Jamie Park,Northgate meeting point\nRiley Stone,Roosevelt meeting point",
  );
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
  const fullyCovered = coveredCount >= riders.length;

  function switchGroup(groupId: string) {
    setActiveGroupId(groupId);
    setPlan(null);
    setError("");
    setDestination("rides");
    setSettingsPage(null);
  }

  function importRoster() {
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter(([name, address]) => Boolean(name && address));

    if (rows.length === 0) {
      setError("Add at least one row in the format Name, Meeting point.");
      return;
    }

    setGroups((current) =>
      current.map((item) => {
        if (item.id !== group.id) {
          return item;
        }

        const existingNames = new Set(
          item.participants.map((participant) =>
            participant.name.toLocaleLowerCase(),
          ),
        );
        const imported = rows
          .filter(([name]) => !existingNames.has(name.toLocaleLowerCase()))
          .map(([name, address], index) => ({
            id: `imported-${group.id}-${Date.now()}-${index}`,
            groupId: group.id,
            name,
            address,
            location: coordinateFor(
              item.participants.length + index,
              group.destination,
            ),
            needsRide: true,
          }));

        return {
          ...item,
          participants: [...item.participants, ...imported],
        };
      }),
    );
    setCsv("");
    setPlan(null);
    setError("");
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
              <span>{userEmail}</span>
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
                <span>{group.participants.length} people</span>
              </div>
              {group.participants.map((participant) => (
                <div className="person-row" key={participant.id}>
                  <div className="person-avatar">{initials(participant.name)}</div>
                  <div>
                    <strong>{participant.name}</strong>
                    <span>{participant.address}</span>
                  </div>
                  <small>
                    {participant.needsRide ? "Needs ride" : "Covered"}
                  </small>
                </div>
              ))}
            </section>

            <h2 className="settings-section-title">Add from a larger group</h2>
            <section className="surface-card import-card">
              <div className="import-heading">
                <Upload size={22} aria-hidden="true" />
                <div>
                  <strong>Import selected people</strong>
                  <span>Paste name and meeting point, one per line.</span>
                </div>
              </div>
              <label>
                <span className="sr-only">Roster rows</span>
                <textarea
                  className="input roster-input"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  placeholder="Name, Meeting point"
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={importRoster}
              >
                Add selected people
              </button>
              {error && <p className="error">{error}</p>}
            </section>
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
                  <small>{group.event}</small>
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
          </>
        )}

        <footer className="app-version">Carpool Together</footer>
      </main>
    </div>
  );
}
