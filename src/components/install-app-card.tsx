"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import {
  appIsInstalled,
  currentInstallPrompt,
  subscribeToInstallPrompt,
  type AppInstallPromptEvent,
} from "@/lib/install-prompt";
import { useI18n } from "@/lib/i18n";

export function InstallAppCard() {
  const { t } = useI18n();
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<AppInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");
  const [isAppleMobile, setIsAppleMobile] = useState(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setInstalled(appIsInstalled());
      setPrompt(currentInstallPrompt());
      setIsAppleMobile(
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      );
    }, 0);
    const unsubscribe = subscribeToInstallPrompt((event) => {
      setPrompt(event);
      setInstalled(appIsInstalled());
    });
    return () => {
      window.clearTimeout(initialize);
      unsubscribe();
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setMessage(
      choice.outcome === "accepted"
        ? t("Installation started. Open Carpool Together from its new app icon.")
        : t("Installation was canceled. You can try again anytime."),
    );
    setPrompt(null);
  }

  return (
    <section className="surface-card install-app-card">
      <div className="card-heading">
        <h2>
          <Smartphone size={20} />
          {t("Install app")}
        </h2>
      </div>
      {installed ? (
        <p className="auth-message" role="status">
          {t("Installed. Carpool Together opens from your Home Screen.")}
        </p>
      ) : (
        <>
          <p className="text-muted">
            {t(
              "Add Carpool Together to your Home Screen for quick, full-screen access.",
            )}
          </p>
          {prompt ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void install()}
            >
              <Download size={18} />
              {t("Install app")}
            </button>
          ) : isAppleMobile ? (
            <ol className="install-steps">
              <li>{t("Open this page in Safari.")}</li>
              <li>{t("Tap Share.")}</li>
              <li>{t("Choose Add to Home Screen, then tap Add.")}</li>
            </ol>
          ) : (
            <p className="notice">
              {t(
                "Open your browser menu and choose Install app or Add to Home screen.",
              )}
            </p>
          )}
        </>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
