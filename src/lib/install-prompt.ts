"use client";

export interface AppInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let promptEvent: AppInstallPromptEvent | null = null;
const listeners = new Set<(event: AppInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event as AppInstallPromptEvent;
    listeners.forEach((listener) => listener(promptEvent));
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    listeners.forEach((listener) => listener(null));
  });
}

export function currentInstallPrompt() {
  return promptEvent;
}

export function subscribeToInstallPrompt(
  listener: (event: AppInstallPromptEvent | null) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function appIsInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}
