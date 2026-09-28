"use client";

import {
  ArrowLeft,
  CalendarDays,
  BookOpen,
  Car,
  Check,
  ChevronDown,
  Copy,
  Heart,
  ImagePlus,
  Info,
  LogOut,
  Settings,
  Share2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppVersion } from "@/components/app-version";
import { GeneratedGroupPin } from "@/components/generated-group-pin";
import { GroupPinSettings } from "@/components/group-pin-settings";
import { InstallAppCard } from "@/components/install-app-card";
import { PushReminderSettings } from "@/components/push-reminder-settings";
import { MemberAvatar } from "@/components/member-avatar";
import { ScheduleViews } from "@/components/schedule-views";
import type { AppGroup } from "@/lib/app-data";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";

type Destination = "rides" | "family" | "team" | "settings";
type SettingsPage = "about" | "groups" | "help" | null;

const destinations = [
  { id: "rides", label: "Rides", icon: Car },
  { id: "family", label: "My family", icon: Heart },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function CarpoolApp({
  initialGroups,
}: {
  initialGroups: AppGroup[];
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
  const [mergeMember, setMergeMember] = useState("");
  const [intoMember, setIntoMember] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [existingGroupPhone, setExistingGroupPhone] = useState("");
  const [existingGroupPin, setExistingGroupPin] = useState("");
  const [createdGroup, setCreatedGroup] = useState<{
    name: string;
    pin: string;
  } | null>(null);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState("");
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

  async function mergeHouseholds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mergeMember || !intoMember || mergeMember === intoMember) {
      setError(t("Choose two different members to combine."));
      return;
    }
    if (
      !window.confirm(
        t(
          "Combine these members into one household? They will share rides and driving responsibility.",
        ),
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/groups/${group.id}/households/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mergeRosterEntryId: mergeMember,
            intoRosterEntryId: intoMember,
          }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not combine households."),
        );
      }
      setMergeMember("");
      setIntoMember("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not combine households."),
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

  async function addExistingGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: sessionError } =
        await createClient().auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(t("Sign-in required."));

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: existingGroupPhone,
          pin: existingGroupPin,
          accessToken,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        groupId?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? t("Could not add the group."));
      }
      if (!result?.groupId) {
        throw new Error(t("Could not add the group."));
      }

      setExistingGroupPhone("");
      setExistingGroupPin("");
      setActiveGroupId(result.groupId);
      setDestination("rides");
      setSettingsPage(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not add the group."),
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
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription =
          await registration?.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch("/api/push-subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!response.ok && response.status !== 404) {
            throw new Error("Could not remove this device's reminders.");
          }
          await subscription.unsubscribe();
        }
      } catch (notificationError) {
        console.error(
          "Could not remove push subscription during sign out",
          notificationError,
        );
      }
    }
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }
    router.refresh();
  }

  async function changeImage(
    endpoint: string,
    image: File,
    key: string,
  ) {
    setUploadingImage(key);
    setError("");
    try {
      const formData = new FormData();
      formData.set("image", image);
      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? t("Could not save the image."));
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not save the image."),
      );
    } finally {
      setUploadingImage("");
    }
  }

  async function removeImage(endpoint: string, key: string) {
    setUploadingImage(key);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? t("Could not remove the image."));
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not remove the image."),
      );
    } finally {
      setUploadingImage("");
    }
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
            <MemberAvatar
              name={group.shortName}
              photoUrl={group.iconUrl}
              size={44}
              className="team-logo"
            />
            <div className="brand-copy">
              <p>{t("{{group}} Carpool", { group: group.name })}</p>
              <span>{group.currentMemberName}</span>
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
            roster={group.roster}
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
                  <MemberAvatar
                    name={member.displayName}
                    photoUrl={member.photoUrl}
                    size={44}
                    className="person-avatar"
                  />
                  <div>
                    <strong>{member.displayName}</strong>
                    <span>{member.phone ?? t("Phone hidden")}</span>
                    {(group.canManageRoster ||
                      group.currentRosterEntryId === member.id) && (
                      <span className="image-actions">
                        <label className="text-button image-upload-button">
                          <ImagePlus size={15} aria-hidden="true" />
                          {uploadingImage === `member-${member.id}`
                            ? t("Uploading…")
                            : member.photoUrl
                              ? t("Change photo")
                              : t("Add photo")}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={Boolean(uploadingImage)}
                            onChange={(event) => {
                              const image = event.target.files?.[0];
                              event.target.value = "";
                              if (image) {
                                void changeImage(
                                  `/api/groups/${group.id}/roster/${member.id}/photo`,
                                  image,
                                  `member-${member.id}`,
                                );
                              }
                            }}
                          />
                        </label>
                        {member.photoUrl && (
                          <button
                            className="text-button"
                            type="button"
                            disabled={Boolean(uploadingImage)}
                            onClick={() =>
                              void removeImage(
                                `/api/groups/${group.id}/roster/${member.id}/photo`,
                                `member-${member.id}`,
                              )
                            }
                          >
                            {t("Remove photo")}
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <small>{t(member.role)}</small>
                </div>
              ))}
              {group.canManageRoster && (
                <form
                  className="schedule-form"
                  onSubmit={mergeHouseholds}
                >
                  <h2>{t("Combine households")}</h2>
                  <p className="text-muted">
                    {t(
                      "Put two members in one household so they share the same riders and rides.",
                    )}
                  </p>
                  <label>
                    {t("Member")}
                    <select
                      className="input"
                      required
                      value={mergeMember}
                      onChange={(event) => setMergeMember(event.target.value)}
                    >
                      <option value="">{t("Choose member")}</option>
                      {group.roster.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Into household of")}
                    <select
                      className="input"
                      required
                      value={intoMember}
                      onChange={(event) => setIntoMember(event.target.value)}
                    >
                      <option value="">{t("Choose member")}</option>
                      {group.roster.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    disabled={
                      loading || !mergeMember || !intoMember || mergeMember === intoMember
                    }
                  >
                    {loading ? t("Saving…") : t("Combine")}
                  </button>
                </form>
              )}
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
        {destination === "settings" && settingsPage === "help" && (
          <HelpSettings onBack={() => setSettingsPage(null)} />
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
            onHelp={() => setSettingsPage("help")}
            onAbout={() => setSettingsPage("about")}
            onCreateGroup={createGroup}
            onGroupName={setNewGroupName}
            existingGroupPhone={existingGroupPhone}
            existingGroupPin={existingGroupPin}
            onExistingGroupPhone={setExistingGroupPhone}
            onExistingGroupPin={setExistingGroupPin}
            onAddExistingGroup={addExistingGroup}
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
            uploadingImage={uploadingImage}
            onChangeImage={changeImage}
            onRemoveImage={removeImage}
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

function HelpSettings({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const sections = [
    [
      "Rides and drivers",
      "Open an event on Rides to see each required direction. A happy car means every ride has a driver; a sad car means at least one still needs help.",
    ],
    [
      "Attendance and absences",
      "Tap a member avatar on an event to change that day. Use My family to add a multi-day absence.",
    ],
    [
      "Maps and routes",
      "Open an assigned ride to launch Google Maps, Apple Maps, or Waze. Group members can see household addresses needed for pickups.",
    ],
    [
      "Install and notifications",
      "Install Carpool Together from Settings for quick Home Screen access. Each adult can enable reminders on their own device.",
    ],
    [
      "Something looks out of date",
      "Check that this device is online, then refresh the app. Confirm the event date and member status before changing it again.",
    ],
  ] as const;

  return (
    <>
      <button className="text-button back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        {t("Settings")}
      </button>
      <div className="screen-heading">
        <h1>{t("Help")}</h1>
        <p>{t("Quick answers for planning and driving carpools.")}</p>
      </div>
      <div className="help-sections">
        {sections.map(([title, copy]) => (
          <section className="surface-card" key={title}>
            <h2>{t(title)}</h2>
            <p className="text-muted">{t(copy)}</p>
          </section>
        ))}
      </div>
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
              <MemberAvatar
                name={item.shortName}
                photoUrl={item.iconUrl}
                size={42}
                className="settings-group-logo"
              />
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
  onHelp: () => void;
  onAbout: () => void;
  onCreateGroup: (event: FormEvent<HTMLFormElement>) => void;
  onGroupName: (value: string) => void;
  existingGroupPhone: string;
  existingGroupPin: string;
  onExistingGroupPhone: (value: string) => void;
  onExistingGroupPin: (value: string) => void;
  onAddExistingGroup: (event: FormEvent<HTMLFormElement>) => void;
  onCreatedGroupDone: () => void;
  onShowDelete: () => void;
  onDeleteConfirmation: (value: string) => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  uploadingImage: string;
  onChangeImage: (endpoint: string, image: File, key: string) => Promise<void>;
  onRemoveImage: (endpoint: string, key: string) => Promise<void>;
};

function SettingsHome(props: SettingsHomeProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="screen-heading">
        <h1>{t("Settings")}</h1>
        <p>{props.group.name}</p>
      </div>
      {props.group.canManageRoster && (
        <>
          <h2 className="settings-section-title">{t("Group appearance")}</h2>
          <section className="surface-card group-appearance-card">
            <MemberAvatar
              name={props.group.shortName}
              photoUrl={props.group.iconUrl}
              size={72}
              className="group-icon-preview"
            />
            <div>
              <h3>{t("Group icon")}</h3>
              <p className="text-muted">
                {t("Shown in the app header and group switcher.")}
              </p>
              <span className="image-actions">
                <label className="secondary-button image-upload-button">
                  <ImagePlus size={17} aria-hidden="true" />
                  {props.uploadingImage === "group-icon"
                    ? t("Uploading…")
                    : props.group.iconUrl
                      ? t("Change icon")
                      : t("Add icon")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={Boolean(props.uploadingImage)}
                    onChange={(event) => {
                      const image = event.target.files?.[0];
                      event.target.value = "";
                      if (image) {
                        void props.onChangeImage(
                          `/api/groups/${props.group.id}/icon`,
                          image,
                          "group-icon",
                        );
                      }
                    }}
                  />
                </label>
                {props.group.iconUrl && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={Boolean(props.uploadingImage)}
                    onClick={() =>
                      void props.onRemoveImage(
                        `/api/groups/${props.group.id}/icon`,
                        "group-icon",
                      )
                    }
                  >
                    {t("Remove icon")}
                  </button>
                )}
              </span>
            </div>
          </section>
        </>
      )}
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
            <small>
              {t("Group members can view household addresses for driving and routes.")}
            </small>
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

      <h2 className="settings-section-title">{t("App and notifications")}</h2>
      <InstallAppCard />
      <PushReminderSettings />
      {props.group.role === "owner" && (
        <GroupInvitation
          groupId={props.group.id}
          groupName={props.group.name}
        />
      )}
      <h2 className="settings-section-title">{t("Help and information")}</h2>
      <section className="settings-link-card">
        <button type="button" onClick={props.onHelp}>
          <BookOpen size={22} />
          <span>
            <strong>{t("Help")}</strong>
            <small>
              {t("Using rides, attendance, notifications, and maps.")}
            </small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <h2 className="settings-section-title">{t("Add an existing group")}</h2>
      <section className="surface-card">
        <form className="auth-form" onSubmit={props.onAddExistingGroup}>
          <p className="text-muted">
            {t(
              "Verify another group with its phone number and PIN. Your verified groups will appear in the selector.",
            )}
          </p>
          <label htmlFor="existing-group-phone">{t("Phone number")}</label>
          <div className="auth-input-wrap">
            <input
              id="existing-group-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={30}
              value={props.existingGroupPhone}
              onChange={(event) =>
                props.onExistingGroupPhone(event.target.value)
              }
            />
          </div>
          <label htmlFor="existing-group-pin">{t("Group PIN")}</label>
          <div className="auth-input-wrap">
            <input
              id="existing-group-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              minLength={4}
              maxLength={12}
              value={props.existingGroupPin}
              onChange={(event) => props.onExistingGroupPin(event.target.value)}
            />
          </div>
          <button className="primary-button" disabled={props.loading}>
            {props.loading ? t("Adding…") : t("Add group")}
          </button>
        </form>
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
          <h2 className="settings-section-title">{t("Access")}</h2>
          <GroupPinSettings groupId={props.group.id} />
        </>
      )}

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

function GroupInvitation({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPin() {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/groups/${groupId}/pin`);
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        pin?: string;
      } | null;
      if (!response.ok || !result?.pin) {
        if (active) {
          setError(t(result?.error ?? "Could not load the group PIN."));
        }
      } else if (active) {
        setPin(result.pin);
      }
      if (active) setLoading(false);
    }
    void loadPin();
    return () => {
      active = false;
    };
  }, [groupId, t]);

  const invitation = pin
    ? t(
        "Join {{group}} on Carpool Together!\n\nOpen the app: {{url}}\nGroup PIN: {{pin}}",
        {
          group: groupName,
          url: window.location.origin,
          pin,
        },
      )
    : "";

  function shareOnWhatsApp() {
    setMessage("");
    setCopied(false);
    if (!invitation) return;
    const mobile =
      window.matchMedia("(pointer: coarse)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(invitation)}`,
      mobile ? "_self" : "_blank",
      "noopener,noreferrer",
    );
  }

  async function copyInvitation() {
    setError("");
    setMessage("");
    setCopied(false);
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation);
      setCopied(true);
      setMessage(t("Invitation copied."));
    } catch {
      setError(t("Could not copy the invitation. Select WhatsApp instead."));
    }
  }

  return (
    <>
      <h2 className="settings-section-title">{t("Group invitation")}</h2>
      <section className="surface-card group-invitation-card">
        <div className="card-heading">
          <h2>
            <Share2 size={20} />
            {t("Share group")}
          </h2>
        </div>
        <p className="text-muted">
          {t(
            "Send this group's app link and current PIN to your WhatsApp group.",
          )}
        </p>
        <div
          className="schedule-form"
        >
          <p className="text-muted">
            {t("The current group PIN is added securely when you share.")}
          </p>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
          <div className="confirmation-actions">
            <button
              className="primary-button"
              type="button"
              disabled={loading || !pin}
              onClick={shareOnWhatsApp}
            >
              <Share2 size={18} aria-hidden="true" />
              {loading ? t("Preparing invitation…") : t("Share on WhatsApp")}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={loading || !pin}
              onClick={() => void copyInvitation()}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? t("Invitation copied") : t("Copy invitation")}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
