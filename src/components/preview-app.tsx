"use client";

import { useRef, useState } from "react";
import { CarpoolApp } from "@/components/carpool-app";
import type { AppGroup } from "@/lib/app-data";
import { AppTransportContext } from "@/lib/app-transport";
import { applyPreviewRequest, createPreviewGroups,
  createPreviewAccount,
  createPreviewFamily,
} from "@/lib/preview-data";
import type { NavigationState } from "@/lib/navigation-state";
import { useI18n } from "@/lib/i18n";

export function PreviewApp({ initialGroups, initialNavigation }: {
  initialGroups: AppGroup[];
  initialNavigation: NavigationState;
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState(initialGroups);
  const latest = useRef(groups);

  async function request(url: string, init?: RequestInit) {
    try {
      const match = /^\/api\/groups\/([^/]+)\/(claims|attendance)$/.exec(url);
      if (!match) throw new Error("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.");
      const group = latest.current.find((item) => item.id === match[1]);
      if (!group) throw new Error("Group not found.");
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const updated = applyPreviewRequest(group, match[2], init?.method ?? "GET", body);
      latest.current = latest.current.map((item) => item.id === group.id ? updated : item);
      setGroups(latest.current);
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Change failed." }, { status: 400 });
    }
  }

  async function refresh() {
    latest.current = createPreviewGroups(new Date());
    setGroups(latest.current);
  }

  return <AppTransportContext.Provider value={{ preview: true, request, refresh }}>
    <details className="preview-banner">
      <summary>{t("Local demo · sample data only")}</summary>
      <p>{t("Ride claims and family plans work in memory. Reload to reset. No database changes.")}</p>
    </details>
    <CarpoolApp initialGroups={groups} account={createPreviewAccount()} family={createPreviewFamily()} initialNavigation={initialNavigation} />
  </AppTransportContext.Provider>;
}
