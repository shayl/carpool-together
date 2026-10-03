"use client";

import {
  ArrowLeft,
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
      if (result.groupId) switchGroup(result.groupId, "settings");
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
        await (await import("@/lib/supabase/browser")).createClient().auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(t("Sign-in required."));

      const response = await transport.request("/api/login", {
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
      switchGroup(result.groupId, "rides");
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
            signingOut={signingOut}
            onGroup={(groupId) => switchGroup(groupId, "settings")}
            activeGroupId={group.id}
            group={group}
            groups={groups}
            loading={loading}
            error={error}
            newGroupName={newGroupName}
            createdGroup={createdGroup}
            showDeleteGroup={showDeleteGroup}
            deleteConfirmation={deleteConfirmation}
            onHelp={() => openSettings("help")}
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
  section: SettingsPage;
  onSection: (page: SettingsPage) => void;
  onBack: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  activeGroupId: string;
  onGroup: (id: string) => void;
  group: AppGroup;
  groups: AppGroup[];
  loading: boolean;
  error: string;
  newGroupName: string;
  createdGroup: { name: string; pin: string } | null;
  showDeleteGroup: boolean;
  deleteConfirmation: string;
  onHelp: () => void;
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
  const transport = useAppTransport();
  if (!props.section) return <>
    <div className="screen-heading"><h1>{t("Settings")}</h1><p>{t("Make yourself at home.")}</p></div>
    <section className="settings-link-card">
      <button type="button" onClick={() => props.onSection("preferences")}><Settings size={22} /><span><strong>{t("Preferences")}</strong><small>{t("Language, theme, notifications & install")}</small></span><ChevronDown size={18} /></button>
      <button type="button" onClick={() => props.onSection("groups")}><Users size={22} /><span><strong>{t("Groups")}</strong><small>{t("Switch, join or create a group")}</small></span><ChevronDown size={18} /></button>
      {(props.group.canManageRoster || props.group.role === "owner") && <button type="button" onClick={() => props.onSection("management")}><ShieldCheck size={22} /><span><strong>{t("Group management")}</strong><small>{t("Group appearance, invitations & access")}</small></span><ChevronDown size={18} /></button>}
      <button type="button" onClick={props.onHelp}><BookOpen size={22} /><span><strong>{t("Help & privacy")}</strong><small>{t("Quick answers and important information")}</small></span><ChevronDown size={18} /></button>
    </section>
    <button className="text-button settings-signout" type="button" disabled={props.signingOut || transport.preview} onClick={props.onSignOut}><LogOut size={18} />{t("Sign out")}</button>
    {transport.preview && <p className="preview-note">{t("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.")}</p>}
  </>;
  return (
    <>
      <button className="text-button back-button" type="button" onClick={props.onBack}><ArrowLeft size={18} />{t("Settings")}</button>
      <div className="screen-heading">
        <h1>{t(props.section === "preferences" ? "Preferences" : props.section === "groups" ? "Groups" : "Group management")}</h1>
        <p>{props.group.name}</p>
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
      {props.section === "management" && props.group.canManageRoster && (
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
                    disabled={transport.preview || Boolean(props.uploadingImage)}
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
                    disabled={transport.preview || Boolean(props.uploadingImage)}
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
      {props.section === "management" && props.group.role === "owner" && !transport.preview && (
        <GroupInvitation
          groupId={props.group.id}
          groupName={props.group.name}
        />
      )}
      {props.section === "groups" && <>
      <GroupSettings groups={props.groups} activeGroupId={props.activeGroupId} onGroup={props.onGroup} />
      <details className="settings-task">
      <summary>{t("Add an existing group")}</summary>
      <h2 className="settings-section-title">{t("Add an existing group")}</h2>
      <section className="surface-card">
        <fieldset className="preview-fieldset" disabled={transport.preview}>
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
        </fieldset>
      </section>
      </details>
      <details className="settings-task" open={props.createdGroup ? true : undefined}>
      <summary>{t("Create another group")}</summary>
      <h2 className="settings-section-title">{t("Create another group")}</h2>
      <section className="surface-card">
        <fieldset className="preview-fieldset" disabled={transport.preview}>
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
        </fieldset>
      </section>
      </details>
      </>}
      {props.section === "management" && props.group.role === "owner" && !transport.preview && (
        <>
          <h2 className="settings-section-title">{t("Access")}</h2>
          <GroupPinSettings groupId={props.group.id} />
        </>
      )}

      {props.section === "management" && props.group.role === "owner" && !transport.preview && (
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
