"use client";

import { RefreshCw } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useRef, useState, useTransition, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { beginPull, movePull, PULL_REFRESH_THRESHOLD, releasePull, type PullGesture, type PullPoint } from "@/lib/pull-refresh";

type RefreshControls = {
  refresh: () => void;
  refreshing: boolean;
  feedback: { message: string; error: boolean };
  blocked: boolean;
};

const RefreshContext = createContext<RefreshControls | null>(null);

function useRefreshControls() {
  const controls = useContext(RefreshContext);
  if (!controls) throw new Error("Refresh controls require PullToRefresh.");
  return controls;
}

export function ScheduleRefreshButton() {
  const { t } = useI18n();
  const { refresh, refreshing, blocked } = useRefreshControls();
  return <button
    className="icon-button refresh-schedule-button"
    type="button"
    aria-label={t("Refresh schedule")}
    title={t("Refresh schedule")}
    disabled={refreshing || blocked}
    onClick={refresh}
  >
    <RefreshCw size={20} aria-hidden="true" className={refreshing ? "refresh-spinning" : undefined} />
  </button>;
}

export function RefreshFeedback() {
  const { feedback } = useRefreshControls();
  return feedback.message ? <p
    className={feedback.error ? "auth-error" : "auth-message"}
    role={feedback.error ? "alert" : "status"}
  >{feedback.message}</p> : null;
}

const interactiveSelector = "a, button, input, textarea, select, label, summary, [role=button], [role=slider], [contenteditable]:not([contenteditable=false]), .leaflet-container";
const blockingSelector = 'dialog[open], [aria-modal="true"], form[data-dirty="true"], form[aria-busy="true"], [data-submitting="true"]';

function blockedTarget(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element) || target.closest(interactiveSelector)) return true;
  for (let element: Element | null = target; element && element !== root; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if (/(auto|scroll)/.test(overflow) && element.scrollHeight > element.clientHeight) return true;
  }
  return false;
}

function scrollTop() {
  return Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0);
}

export function PullToRefresh({ children, onRefresh, blocked = false, preview = false, offline = false }: {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  blocked?: boolean;
  preview?: boolean;
  offline?: boolean;
}) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<PullGesture | null>(null);
  const requested = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, startTransition] = useTransition();
  const [feedback, setFeedback] = useState({ message: "", error: false });

  useEffect(() => {
    // router.refresh() is void; keep the lock until React's route transition commits.
    if (!refreshing) requested.current = false;
  }, [refreshing]);

  const refresh = useCallback(() => {
    if (requested.current || refreshing) return;
    if (blocked || document.querySelector(blockingSelector)) {
      setFeedback({ message: t("Finish or discard your changes before refreshing."), error: true });
      return;
    }
    gesture.current = null;
    setDistance(0);
    if (!navigator.onLine) {
      setFeedback({ message: t("You're offline. Reconnect to refresh."), error: true });
      return;
    }
    requested.current = true;
    setFeedback({ message: "", error: false });
    startTransition(async () => {
      try {
        await onRefresh();
        if (!navigator.onLine) throw new Error("You're offline. Reconnect to refresh.");
        setFeedback({
          message: preview ? t("Sample schedule reset. No backend requests.") : t("Schedule refreshed."),
          error: false,
        });
      } catch (error) {
        console.error("Could not refresh the schedule", error);
        setFeedback({
          message: error instanceof Error ? t(error.message) : t("Could not refresh the schedule. Try again."),
          error: true,
        });
      }
    });
  }, [blocked, onRefresh, preview, refreshing, t]);

  const isBlocked = useEffectEvent(() =>
    blocked || requested.current || Boolean(document.querySelector(blockingSelector)),
  );
  const refreshFromGesture = useEffectEvent(refresh);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reset = () => {
      gesture.current = null;
      setDistance(0);
    };
    const point = (touch: Touch, touches: number): PullPoint => ({
      x: touch.clientX, y: touch.clientY, identifier: touch.identifier,
      touches, scrollTop: scrollTop(), blocked: isBlocked(),
    });
    const start = (event: TouchEvent) => {
      reset();
      const touch = event.touches[0];
      if (!touch || blockedTarget(event.target, element)) return;
      gesture.current = beginPull(point(touch, event.touches.length));
      if (gesture.current) setFeedback({ message: "", error: false });
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!gesture.current) return;
      if (!touch || !event.cancelable) { reset(); return; }
      gesture.current = movePull(gesture.current, point(touch, event.touches.length));
      if (!gesture.current) { reset(); return; }
      if (gesture.current.distance > 0) event.preventDefault();
      setDistance(gesture.current.distance);
    };
    const end = (event: TouchEvent) => {
      const shouldRefresh = event.touches.length === 0 &&
        event.changedTouches.length === 1 &&
        event.changedTouches[0].identifier === gesture.current?.identifier &&
        !isBlocked() && scrollTop() <= 0 && releasePull(gesture.current);
      reset();
      if (shouldRefresh) refreshFromGesture();
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", reset);
    element.addEventListener("pointercancel", reset);

    const documentRoot = document.documentElement;
    const alreadyCustom = documentRoot.classList.contains("custom-pull-refresh");
    if (navigator.maxTouchPoints > 0) documentRoot.classList.add("custom-pull-refresh");
    return () => {
      gesture.current = null;
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", reset);
      element.removeEventListener("pointercancel", reset);
      if (!alreadyCustom) documentRoot.classList.remove("custom-pull-refresh");
    };
  }, []);

  return <RefreshContext.Provider value={{
    refresh, refreshing, blocked,
    feedback: refreshing ? { message: "", error: false } :
      offline && feedback.message && !feedback.error
        ? { message: t("You're offline. Reconnect to refresh."), error: true }
        : feedback,
  }}>
    <div ref={root} data-pull-refresh>
    {(distance > 0 || refreshing) && <div
      className="pull-refresh-indicator"
      role="status"
      aria-live="polite"
      style={{ opacity: refreshing ? 1 : Math.min(distance / 36, 1) }}
    >
      <RefreshCw size={18} aria-hidden="true" className={refreshing ? "refresh-spinning" : undefined} />
      <span>{refreshing ? t("Refreshing…") : distance >= PULL_REFRESH_THRESHOLD ? t("Release to refresh") : t("Pull to refresh")}</span>
    </div>}
    {children}
    </div>
  </RefreshContext.Provider>;
}
