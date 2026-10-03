"use client";

import {
  ArrowLeft,
  BookOpen,
  Car,
  ChevronDown,
  Heart,
  ImagePlus,
  Info,
  LogOut,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppVersion } from "@/components/app-version";
import { InstallAppCard } from "@/components/install-app-card";
import { PushReminderSettings } from "@/components/push-reminder-settings";
import { MemberAvatar } from "@/components/member-avatar";
import { PersonalCodeSettings } from "@/components/personal-code-settings";
import { ThemePicker } from "@/components/theme-picker";
import { ScheduleViews } from "@/components/schedule-views";
import { Sheet } from "@/components/sheet";
import { PullToRefresh, RefreshFeedback, ScheduleRefreshButton } from "@/components/pull-to-refresh";
import { mergeGroupSchedules } from "@/lib/all-groups-schedule";
import type { AppAccount, AppFamily, AppGroup } from "@/lib/app-data";
import { LanguagePicker, useI18n } from "@/lib/i18n";
import { AppTransportContext, useAppTransport, type AppTransport } from "@/lib/app-transport";
import { availableGroupId, settingsSectionFromParams, type SettingsSection } from "@/lib/ui-navigation";
import {
  navigationStateFromSearchParams,
  type Destination,
  type NavigationState,
} from "@/lib/navigation-state";

type SettingsPage = SettingsSection | null;

const destinations = [
  { id: "rides", label: "Rides", icon: Car },
  { id: "family", label: "My family", icon: Heart },
  { id: "groups", label: "Groups", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function CarpoolApp({
  initialGroups,
  account,
  family,
  initialNavigation,
}: {
  initialGroups: AppGroup[];
  account: AppAccount;
  family: AppFamily | null;
  initialNavigation: NavigationState;
}) {
  const router = useRouter();
  const sourceTransport = useAppTransport();
  const [pendingRequests, setPendingRequests] = useState(0);
  const transport = useMemo<AppTransport>(() => ({
    ...sourceTransport,
    async request(url, init) {
      setPendingRequests((count) => count + 1);
      try {
        return await sourceTransport.request(url, init);
      } finally {
        setPendingRequests((count) => count - 1);
      }
    },
  }), [sourceTransport]);
  const { t } = useI18n();
  const groups = initialGroups;
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0].id);
  const [destination, setDestination] = useState<Destination>(
    initialNavigation.destination,
  );
  const [settingsPage, setSettingsPage] = useState<SettingsPage>(null);
  const [rosterMode, setRosterMode] = useState<"single" | "bulk">("single");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberRole, setMemberRole] = useState<
    "admin" | "coordinator" | "member"
  >("member");
  const [csv, setCsv] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [offline, setOffline] = useState(false);

  const group = useMemo(
    () => groups.find((item) => item.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );
  const groupPreferenceKey = `carpool-active-group:${groups.map((item) => item.currentRosterEntryId ?? item.id).sort().join(":")}`;

  useEffect(() => {
    const updateOnlineState = () => setOffline(!navigator.onLine);
    const restoreNavigation = () => {
      const params = new URL(window.location.href).searchParams;
      setDestination(
        navigationStateFromSearchParams(
          params,
        ).destination,
      );
      setSettingsPage(settingsSectionFromParams(params));
      setActiveGroupId(availableGroupId(groups.map((item) => item.id), params.get("group") ?? window.localStorage.getItem(groupPreferenceKey)));
    };
    updateOnlineState();
    restoreNavigation();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    window.addEventListener("popstate", restoreNavigation);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener("popstate", restoreNavigation);
    };
  }, [groups, groupPreferenceKey]);

  useEffect(() => {
    if (transport.preview) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };
    async function subscribe() {
      const { createClient } = await import("@/lib/supabase/browser");
      if (disposed) return;
      const client = createClient();
      const groupIds = groups.map((item) => item.id);
      const channel = client.channel(`group-updates-${groupIds.join("-")}`);
      for (const table of [
        "group_households",
        "group_access_roster",
        "participants",
        "group_locations",
        "group_events",
        "group_event_attendance",
        "group_ride_claims",
        "group_breaks",
        "group_absence_periods",
        "group_schedule_templates",
      ]) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `group_id=in.(${groupIds.join(",")})`,
          },
          refresh,
        );
      }
      channel.subscribe();
      unsubscribe = () => { void client.removeChannel(channel); };
    }
    void subscribe().catch((caught) => {
      console.error("Could not connect to live updates", caught);
      if (!disposed) setError(t("Could not connect to live updates. Refresh to see the latest schedule."));
    });
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      unsubscribe?.();
    };
  }, [groups, router, transport.preview, t]);

  function navigate(nextDestination: Destination, history: "push" | "replace" = "push") {
    setDestination(nextDestination);
    setSettingsPage(null);
    setShowAddMembers(false);
    resetGroupState();
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextDestination);
    url.searchParams.delete("settings");
    window.history[history === "push" ? "pushState" : "replaceState"](
      null,
      "",
      url,
    );
  }

  function resetGroupState() {
    setError("");
    setShowDeleteGroup(false);
    setDeleteConfirmation("");
  }

  function switchGroup(groupId: string, nextDestination: Destination) {
    setActiveGroupId(groupId);
    window.localStorage.setItem(groupPreferenceKey, groupId);
    const url = new URL(window.location.href);
    url.searchParams.set("group", groupId);
    window.history.replaceState(null, "", url);
    navigate(nextDestination, "replace");
  }

  function openSettings(page: SettingsPage) {
    setSettingsPage(page);
    resetGroupState();
    const url = new URL(window.location.href);
    if (page) url.searchParams.set("settings", page);
    else url.searchParams.delete("settings");
    window.history.pushState(null, "", url);
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
      const response = await transport.request(`/api/groups/${group.id}/roster`, {
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
      setShowAddMembers(false);
      if (!transport.preview) router.refresh();
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
      const response = await transport.request(`/api/groups/${group.id}/roster`, {
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
      setShowAddMembers(false);
      if (!transport.preview) router.refresh();
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

  async function changeMemberRole(rosterEntryId: string, role: string) {
    setLoading(true);
    setError("");
    try {
      const response = await transport.request(`/api/groups/${group.id}/roster/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterEntryId, role }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not change the role."),
        );
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not change the role."),
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
      const response = await transport.request("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
      });
      const result = (await response.json()) as {
        error?: string;
        groupId?: string;
      };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not create the group."),
        );
      }

      setNewGroupName("");
      if (result.groupId) switchGroup(result.groupId, "groups");
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
      const response = await transport.request(`/api/groups/${group.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ? t(result.error) : t("Could not delete the group."),
        );
      }
      const nextGroup = groups.find((item) => item.id !== group.id);
      if (nextGroup) switchGroup(nextGroup.id, "settings");
      else navigate("rides");
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
    if (transport.preview) {
      setError(t("Account actions are disabled in the local demo."));
      return;
    }
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
    const { error: signOutError } = await (await import("@/lib/supabase/browser")).createClient().auth.signOut();
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
      const response = await transport.request(endpoint, {
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
      const response = await transport.request(endpoint, { method: "DELETE" });
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
    <AppTransportContext.Provider value={transport}>
    <PullToRefresh
      blocked={loading || Boolean(uploadingImage) || signingOut || pendingRequests > 0}
      preview={transport.preview}
      offline={offline}
      onRefresh={() => transport.preview ? transport.refresh() : router.refresh()}
    >
    <div
      className="app-shell"
      data-offline={offline}
    >
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-lockup">
            <div className="brand-copy">
              <p>{t("Carpool Together")}</p>
              <span>{account.displayName}</span>
            </div>
            <ScheduleRefreshButton />
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
              navigate(id);
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
        <RefreshFeedback />
        {error && destination !== "settings" && !showAddMembers && <p className="auth-error" role="alert">{error}</p>}
        {offline && (
          <div className="notice offline-notice" role="status">
            {t(
              "Offline — showing saved information. Reconnect to make changes or open a route.",
            )}
          </div>
        )}
        {destination === "groups" && (
          <>
            {groups.length > 1 && (
              <section className="surface-card groups-picker">
                <h2>{t("Your groups")}</h2>
                <p className="text-muted">
                  {t("Pick the group to manage. Rides always show every group.")}
                </p>
                <GroupSettings
                  groups={groups}
                  activeGroupId={group.id}
                  onGroup={(groupId) => switchGroup(groupId, "groups")}
                />
              </section>
            )}
            <details className="settings-task">
              <summary>{t("Create another group")}</summary>
              <section className="surface-card">
                <fieldset className="preview-fieldset" disabled={transport.preview}>
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
                    <p className="auth-footnote">
                      {t("Your family comes with you. Add people by phone number once the group exists.")}
                    </p>
                    <button className="primary-button" disabled={loading}>
                      {loading ? t("Creating…") : t("Create group")}
                    </button>
                  </form>
                </fieldset>
                {error && <p className="auth-error">{error}</p>}
              </section>
            </details>
            {group.canManageRoster && (
              <details className="settings-task">
                <summary>{t("Manage {{group}}", { group: group.name })}</summary>
                <GroupManagement
                  group={group}
                  loading={loading}
                  showDeleteGroup={showDeleteGroup}
                  deleteConfirmation={deleteConfirmation}
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
              </details>
            )}
          </>
        )}
        {(destination === "rides" ||
          destination === "family" ||
          destination === "groups") && (
          <ScheduleViews
            key={destination === "rides" ? "rides" : `${group.id}-${destination}`}
            groupId={group.id}
            groupName={group.name}
            canManage={group.canManageRoster}
            view={destination}
            schedule={
              destination === "rides" ? mergeGroupSchedules(groups) : group.schedule
            }
            groups={groups}
            family={family}
            roster={group.roster}
            currentRosterEntryId={group.currentRosterEntryId}
            uploadingImage={uploadingImage}
            onMemberPhoto={(rosterEntryId, image) =>
              void changeImage(
                `/api/groups/${group.id}/roster/${rosterEntryId}/photo`,
                image,
                `member-${rosterEntryId}`,
              )
            }
            onMemberPhotoRemove={(rosterEntryId) =>
              void removeImage(
                `/api/groups/${group.id}/roster/${rosterEntryId}/photo`,
                `member-${rosterEntryId}`,
              )
            }
            onPromote={changeMemberRole}
            offline={offline}
            initialNavigation={initialNavigation}
            onNavigate={(nextDestination) => {
              navigate(nextDestination);
            }}
            peopleActions={group.canManageRoster ? <button className="primary-button" type="button" onClick={() => {
              setError("");
              setShowAddMembers(true);
            }}><Users size={18} />{t("Add person")}</button> : undefined}
          />
        )}

        {destination === "groups" && showAddMembers && (
          <Sheet title={t("Add people to the group")} busy={loading} onClose={() => setShowAddMembers(false)}>
            {group.canManageRoster && (
              <>
                <section className="surface-card import-card">
                  <fieldset disabled={transport.preview} className="preview-fieldset">
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
                  </fieldset>
                  {transport.preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
                </section>
              </>
            )}
          </Sheet>
        )}

        {destination === "settings" && settingsPage === "about" && (
          <AboutSettings onBack={() => openSettings(null)} />
        )}
        {destination === "settings" && settingsPage === "help" && (
          <HelpSettings onBack={() => openSettings(null)} onAbout={() => openSettings("about")} onPrivacy={() => router.push("/privacy")} />
        )}
        {destination === "settings" && settingsPage !== "about" && settingsPage !== "help" && (
          <SettingsHome
            section={settingsPage}
            onSection={openSettings}
            onBack={() => openSettings(null)}
            onSignOut={signOut}
            account={account}
            signingOut={signingOut}
            error={error}
            onHelp={() => openSettings("help")}
          />
        )}
        <footer>
          <AppVersion />
        </footer>
      </main>
    </div>
    </PullToRefresh>
    </AppTransportContext.Provider>
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

function HelpSettings({ onBack, onAbout, onPrivacy }: { onBack: () => void; onAbout: () => void; onPrivacy: () => void }) {
  const { t } = useI18n();
  const sections = [
    [
      "Rides and drivers",
      "Open an event on Rides to see each required direction. A happy car means every ride has a driver; a sad car means at least one still needs help.",
    ],
    [
      "Attendance and absences",
      "Choose Change plans on Rides, or select an event in My family. Attendance, ride there, and ride home are separate choices.",
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
      <section className="settings-link-card">
        <button type="button" onClick={onPrivacy}><ShieldCheck size={22} /><span><strong>{t("Privacy and consent")}</strong><small>{t("Group members can view household addresses for driving and routes.")}</small></span><ChevronDown size={18} /></button>
        <button type="button" onClick={onAbout}><Info size={22} /><span><strong>{t("About and important notice")}</strong><small>{t("What this service does—and does not—provide.")}</small></span><ChevronDown size={18} /></button>
      </section>
    </>
  );
}

function GroupSettings({
  groups,
  activeGroupId,
  onGroup,
}: {
  groups: AppGroup[];
  activeGroupId: string;
  onGroup: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
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
  account: AppAccount;
  section: SettingsPage;
  onSection: (page: SettingsPage) => void;
  onBack: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  error: string;
  onHelp: () => void;
};

function SettingsHome(props: SettingsHomeProps) {
  const { t } = useI18n();
  const transport = useAppTransport();
  if (!props.section) return <>
    <div className="screen-heading"><h1>{t("Settings")}</h1><p>{t("Make yourself at home.")}</p></div>
    <section className="settings-link-card">
      <button type="button" onClick={() => props.onSection("preferences")}><Settings size={22} /><span><strong>{t("Preferences")}</strong><small>{t("Language, theme, notifications & install")}</small></span><ChevronDown size={18} /></button>
      <button type="button" onClick={() => props.onSection("code")}><ShieldCheck size={22} /><span><strong>{t("Personal code")}</strong><small>{t("Change the code you sign in with")}</small></span><ChevronDown size={18} /></button>
      <button type="button" onClick={props.onHelp}><BookOpen size={22} /><span><strong>{t("Help & privacy")}</strong><small>{t("Quick answers and important information")}</small></span><ChevronDown size={18} /></button>
    </section>
    <button className="text-button settings-signout" type="button" disabled={props.signingOut || transport.preview} onClick={props.onSignOut}><LogOut size={18} />{t("Sign out")}</button>
    {transport.preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
  </>;
  return (
    <>
      <button className="text-button back-button" type="button" onClick={props.onBack}><ArrowLeft size={18} />{t("Settings")}</button>
      <div className="screen-heading">
        <h1>{t(props.section === "preferences" ? "Preferences" : "Personal code")}</h1>
        <p>{props.account.displayName}</p>
      </div>
      {props.section === "preferences" && <>
      <section className="surface-card"><h3>{t("Language")}</h3><LanguagePicker /></section>
      <h2 className="settings-section-title">{t("Appearance")}</h2>
      <section className="surface-card">
        <h3>{t("Theme")}</h3>
        <p className="text-muted">
          {t("Match your device, or pick light or dark for this browser.")}
        </p>
        <ThemePicker />
      </section>
      <h2 className="settings-section-title">{t("App and notifications")}</h2>
      {transport.preview ? <section className="surface-card"><h3>{t("Install and notifications")}</h3><p className="text-muted">{t("Notifications and installation are available in the live app, not this local demo.")}</p></section> : <><InstallAppCard /><PushReminderSettings /></>}
      </>}
      {props.section === "code" && (
        <PersonalCodeSettings phone={props.account.phone} />
      )}
      {props.error && <p className="auth-error">{props.error}</p>}
    </>
  );
}

// Group-level management lives in the Groups tab, next to the group it acts
// on. Settings is account-level only.
type GroupManagementProps = {
  group: AppGroup;
  loading: boolean;
  showDeleteGroup: boolean;
  deleteConfirmation: string;
  onShowDelete: () => void;
  onDeleteConfirmation: (value: string) => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  uploadingImage: string;
  onChangeImage: (endpoint: string, image: File, key: string) => Promise<void>;
  onRemoveImage: (endpoint: string, key: string) => Promise<void>;
};

function GroupManagement({
  group,
  loading,
  showDeleteGroup,
  deleteConfirmation,
  onShowDelete,
  onDeleteConfirmation,
  onCancelDelete,
  onDelete,
  uploadingImage,
  onChangeImage,
  onRemoveImage,
}: GroupManagementProps) {
  const { t } = useI18n();
  const transport = useAppTransport();
  return (
    <>
      {group.canManageRoster && (
        <>
          <h2 className="settings-section-title">{t("Group appearance")}</h2>
          <section className="surface-card group-appearance-card">
            <MemberAvatar
              name={group.shortName}
              photoUrl={group.iconUrl}
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
                  {uploadingImage === "group-icon"
                    ? t("Uploading…")
                    : group.iconUrl
                      ? t("Change icon")
                      : t("Add icon")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={transport.preview || Boolean(uploadingImage)}
                    onChange={(event) => {
                      const image = event.target.files?.[0];
                      event.target.value = "";
                      if (image) {
                        void onChangeImage(
                          `/api/groups/${group.id}/icon`,
                          image,
                          "group-icon",
                        );
                      }
                    }}
                  />
                </label>
                {group.iconUrl && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={transport.preview || Boolean(uploadingImage)}
                    onClick={() =>
                      void onRemoveImage(
                        `/api/groups/${group.id}/icon`,
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
      {group.role === "owner" && !transport.preview && (
        <>
          <h2 className="settings-section-title">{t("Danger zone")}</h2>
          <section className="surface-card danger-card">
            <div>
              <h3>{t("Delete this group")}</h3>
              <p className="text-muted">
                {t(
                  "Permanently delete this group, its roster, and all of its carpool data.",
                )}
                {transport.preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
              </p>
            </div>
            {!showDeleteGroup ? (
              <button
                className="danger-button"
                type="button"
                onClick={onShowDelete}
              >
                {t("Delete group")}
              </button>
            ) : (
              <div className="delete-group-confirmation">
                <label htmlFor="delete-group-confirmation">
                  {t("Type {{name}} to confirm.", { name: group.name })}
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="delete-group-confirmation"
                    value={deleteConfirmation}
                    onChange={(event) =>
                      onDeleteConfirmation(event.target.value)
                    }
                  />
                </div>
                <div className="confirmation-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onCancelDelete}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={
                      loading ||
                      deleteConfirmation !== group.name
                    }
                    onClick={onDelete}
                  >
                    {loading
                      ? t("Deleting…")
                      : t("Permanently delete group")}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
