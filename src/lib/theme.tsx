"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "carpool-theme";
const THEME_CHANGE_EVENT = "carpool-theme-change";

// Runs before first paint so the stored choice is already on <html> and the
// page never flashes the wrong theme.
export const themeBootstrapScript = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}");if(c==="light"||c==="dark"){document.documentElement.dataset.theme=c}}catch(e){}})();`;

function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private browsing can block storage; the OS preference still applies.
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Keep the in-page change even when it cannot be persisted.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme() {
  const choice = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    (): ThemeChoice => "system",
  );
  const choose = useCallback((next: ThemeChoice) => setTheme(next), []);
  return { choice, setTheme: choose };
}
