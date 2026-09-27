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
import { AppVersion } from "@/components/app-version";
import { GeneratedGroupPin } from "@/components/generated-group-pin";
import { ScheduleViews } from "@/components/schedule-views";
import type { AppGroup } from "@/lib/app-data";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";

type Destination = "rides" | "family" | "team" | "settings";
type SettingsPage = "about" | "groups" | null;

const destinations = [
  { id: "rides", label: "Rides", icon: Car },
  { id: "family", label: "My family", icon: Heart },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
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
  const [settingsPage, setSettingsPage] = useState<SettingsPage>(null);
  const [rosterMode, setRosterMode] = useState<"single" | "bulk">("single");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberRole, setMemberRole] = useState<
    "admin" | "coordinator" | "member"
  >("member");
  const [csv, setCsv] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [createdGroup, setCreatedGroup] = useState<{
    name: string;
    pin: string;
  } | null>(null);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const group = useMemo(
    () => groups.find((item) => item.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );

  function resetGroupState() {
    setError("");
    setShowDeleteGroup(false);
    setDeleteConfirmation("");
  }

  function switchGroup(groupId: string, nextDestination: Destination) {
    setActiveGroupId(groupId);
    setDestination(nextDestination);
    setSettingsPage(null);
    resetGroupState();
  }

  async function importRoster() {
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter(([name, phone]) => Boolean(name && phone));
    if (!rows.length) {
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
          result.error ? t(result.error) : t("Could not update the roster."),
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

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/groups/${group.id}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              displayName: memberDisplayName,
              phone: memberPhone,
              role: memberRole,
            },
          ],
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not add the person."),
        );
      }
      setMemberDisplayName("");
      setMemberPhone("");
      setMemberRole("member");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not add the person."),
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
        body: JSON.stringify({ name: newGroupName }),
      });
      const result = (await response.json()) as {
        error?: string;
        groupId?: string;
        pin?: string;
      };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not create the group."),
        );
      }
      if (!result.pin) {
        throw new Error(t("Could not generate a group PIN."));
      }
      setCreatedGroup({ name: newGroupName, pin: result.pin });
      setNewGroupName("");
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

  async function deleteGroup() {
    if (deleteConfirmation !== group.name) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not delete the group."),
        );
      }
      const nextGroup = groups.find((item) => item.id !== group.id);
      if (nextGroup) setActiveGroupId(nextGroup.id);
      setDestination(nextGroup ? "settings" : "rides");
      setShowDeleteGroup(false);
      setDeleteConfirmation("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("Could not delete the group."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    const { error: signOutError } = await createClient().auth.signOut();
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
                onChange={(event) => switchGroup(event.target.value, "rides")}
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
              resetGroupState();
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
        {(destination === "rides" ||
          destination === "family" ||
          destination === "team") && (
          <ScheduleViews
            groupId={group.id}
            groupName={group.name}
            canManage={group.canManageRoster}
            view={destination}
            schedule={group.schedule}
          />
        )}

        {destination === "team" && (
          <>
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
                      <strong>{t("Add people to the group")}</strong>
                      <span>{t("Add one person or import several at once.")}</span>
                    </div>
                  </div>
                  <div className="ride-filters" role="group">
                    <button
                      type="button"
                      aria-pressed={rosterMode === "single"}
                      onClick={() => setRosterMode("single")}
                    >
                      {t("Add one person")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={rosterMode === "bulk"}
                      onClick={() => setRosterMode("bulk")}
                    >
                      {t("Bulk import")}
                    </button>
                  </div>
                  {rosterMode === "single" ? (
                    <form className="schedule-form" onSubmit={addMember}>
                      <label>
                        {t("Name")}
                        <input
                          className="input"
                          required
                          maxLength={100}
                          autoComplete="name"
                          value={memberDisplayName}
                          onChange={(event) =>
                            setMemberDisplayName(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        {t("Phone number")}
                        <input
                          className="input"
                          required
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          maxLength={30}
                          value={memberPhone}
                          onChange={(event) =>
                            setMemberPhone(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        {t("Role")}
                        <select
                          className="input"
                          value={memberRole}
                          onChange={(event) =>
                            setMemberRole(
                              event.target.value as
                                | "admin"
                                | "coordinator"
                                | "member",
                            )
                          }
                        >
                          <option value="member">{t("member")}</option>
                          <option value="coordinator">
                            {t("coordinator")}
                          </option>
                          <option value="admin">{t("admin")}</option>
                        </select>
                      </label>
                      <button
                        className="primary-button"
                        disabled={loading}
                      >
                        {loading ? t("Adding…") : t("Add person")}
                      </button>
                    </form>
                  ) : (
                    <>
                      <label>
                        <span className="sr-only">{t("Roster rows")}</span>
                        <textarea
                          className="input roster-input"
                          value={csv}
                          onChange={(event) => setCsv(event.target.value)}
                          placeholder={`${t("Alex Morgan")}, 425-555-0100\nSam Rivera, 425-555-0101`}
                        />
                      </label>
                      <p className="text-muted">
                        {t("Paste name and phone, one per line.")}
                      </p>
                      <button
                        className="primary-button"
                        type="button"
                        onClick={importRoster}
                        disabled={loading}
                      >
                        {loading ? t("Adding…") : t("Import people")}
                      </button>
                    </>
                  )}
                  {error && <p className="error">{error}</p>}
                </section>
              </>
            )}
          </>
        )}

        {destination === "settings" && settingsPage === "about" && (
          <AboutSettings onBack={() => setSettingsPage(null)} />
        )}
        {destination === "settings" && settingsPage === "groups" && (
          <GroupSettings
            groups={groups}
            activeGroupId={activeGroupId}
            onBack={() => setSettingsPage(null)}
            onGroup={(groupId) => switchGroup(groupId, "settings")}
          />
        )}
        {destination === "settings" && settingsPage === null && (
          <SettingsHome
            group={group}
            groups={groups}
            loading={loading}
            error={error}
            newGroupName={newGroupName}
            createdGroup={createdGroup}
            showDeleteGroup={showDeleteGroup}
            deleteConfirmation={deleteConfirmation}
            onGroups={() => setSettingsPage("groups")}
            onSchedule={() => setDestination("rides")}
            onPrivacy={() => router.push("/privacy")}
            onAbout={() => setSettingsPage("about")}
            onCreateGroup={createGroup}
            onGroupName={setNewGroupName}
            onCreatedGroupDone={() => setCreatedGroup(null)}
            onShowDelete={() => {
              setShowDeleteGroup(true);
              setError("");
            }}
            onDeleteConfirmation={setDeleteConfirmation}
            onCancelDelete={() => {
              setShowDeleteGroup(false);
              setDeleteConfirmation("");
              setError("");
            }}
            onDelete={deleteGroup}
          />
        )}
        <footer>
          <AppVersion />
        </footer>
      </main>
    </div>
  );
}

function AboutSettings({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <button className="text-button back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        {t("Settings")}
      </button>
      <div className="screen-heading">
        <h1>{t("About")}</h1>
        <p>{t("Private groups. Smarter rides.")}</p>
      </div>
      <section className="surface-card about-card">
        <div className="about-heading">
          <Info size={24} />
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
        </div>
        <AppVersion className="about-version" />
      </section>
    </>
  );
}

function GroupSettings({
  groups,
  activeGroupId,
  onBack,
  onGroup,
}: {
  groups: AppGroup[];
  activeGroupId: string;
  onBack: () => void;
  onGroup: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button className="text-button back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        {t("Settings")}
      </button>
      <div className="screen-heading">
        <h1>{t("Switch group")}</h1>
        <p>{t("Choose the group you want to manage.")}</p>
      </div>
      <section className="settings-link-card" aria-label={t("Your groups")}>
        {groups.map((item) => {
          const current = item.id === activeGroupId;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => onGroup(item.id)}
            >
              <span className="settings-group-logo">{item.shortName}</span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {current ? t("Current group") : t("Open this group")}
                </small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          );
        })}
      </section>
    </>
  );
}

type SettingsHomeProps = {
  group: AppGroup;
  groups: AppGroup[];
  loading: boolean;
  error: string;
  newGroupName: string;
  createdGroup: { name: string; pin: string } | null;
  showDeleteGroup: boolean;
  deleteConfirmation: string;
  onGroups: () => void;
  onSchedule: () => void;
  onPrivacy: () => void;
  onAbout: () => void;
  onCreateGroup: (event: FormEvent<HTMLFormElement>) => void;
  onGroupName: (value: string) => void;
  onCreatedGroupDone: () => void;
  onShowDelete: () => void;
  onDeleteConfirmation: (value: string) => void;
  onCancelDelete: () => void;
  onDelete: () => void;
};

function SettingsHome(props: SettingsHomeProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="screen-heading">
        <h1>{t("Settings")}</h1>
        <p>{props.group.name}</p>
      </div>
      <h2 className="settings-section-title">{t("Active group")}</h2>
      <section className="settings-link-card">
        <button type="button" onClick={props.onGroups}>
          <Users size={22} />
          <span>
            <strong>{t("Switch group")}</strong>
            <small>
              {t("Your account belongs to {{count}} private groups.", {
                count: props.groups.length,
              })}
            </small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={props.onSchedule}>
          <CalendarDays size={22} />
          <span>
            <strong>{t("Group schedule")}</strong>
            <small>{t("Open events and ride assignments.")}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={props.onPrivacy}>
          <ShieldCheck size={22} />
          <span>
            <strong>{t("Privacy and consent")}</strong>
            <small>{t("Addresses stay private to authorized rides.")}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={props.onAbout}>
          <Info size={22} />
          <span>
            <strong>{t("About and important notice")}</strong>
            <small>{t("What this service does—and does not—provide.")}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <h2 className="settings-section-title">{t("Create another group")}</h2>
      <section className="surface-card">
        {props.createdGroup ? (
          <GeneratedGroupPin
            groupName={props.createdGroup.name}
            pin={props.createdGroup.pin}
            onContinue={props.onCreatedGroupDone}
          />
        ) : (
          <form className="auth-form" onSubmit={props.onCreateGroup}>
            <label htmlFor="new-group-name">{t("Group name")}</label>
            <div className="auth-input-wrap">
              <input
                id="new-group-name"
                required
                maxLength={100}
                value={props.newGroupName}
                onChange={(event) => props.onGroupName(event.target.value)}
                placeholder={t("Neighborhood carpool")}
              />
            </div>
            <p className="auth-footnote">
              {t("A secure 6-digit group PIN will be generated automatically.")}
            </p>
            <button className="primary-button" disabled={props.loading}>
              {props.loading ? t("Creating…") : t("Create group")}
            </button>
          </form>
        )}
      </section>

      {props.group.role === "owner" && (
        <>
          <h2 className="settings-section-title">{t("Danger zone")}</h2>
          <section className="surface-card danger-card">
            <div>
              <h3>{t("Delete this group")}</h3>
              <p className="text-muted">
                {t(
                  "Permanently delete this group, its roster, and all of its carpool data.",
                )}
              </p>
            </div>
            {!props.showDeleteGroup ? (
              <button
                className="danger-button"
                type="button"
                onClick={props.onShowDelete}
              >
                {t("Delete group")}
              </button>
            ) : (
              <div className="delete-group-confirmation">
                <label htmlFor="delete-group-confirmation">
                  {t("Type {{name}} to confirm.", { name: props.group.name })}
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="delete-group-confirmation"
                    value={props.deleteConfirmation}
                    onChange={(event) =>
                      props.onDeleteConfirmation(event.target.value)
                    }
                  />
                </div>
                <div className="confirmation-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={props.onCancelDelete}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={
                      props.loading ||
                      props.deleteConfirmation !== props.group.name
                    }
                    onClick={props.onDelete}
                  >
                    {props.loading
                      ? t("Deleting…")
                      : t("Permanently delete group")}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      {props.error && <p className="auth-error">{props.error}</p>}
    </>
  );
}
