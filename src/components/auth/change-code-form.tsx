"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppVersion } from "@/components/app-version";
import { LanguagePicker, useI18n } from "@/lib/i18n";

// Shown before the app itself when the account still has the code derived
// from its phone number. Anyone who knows the number knows that code, so it
// has to be replaced before it protects anything.
export function ChangeCodeForm({ phone }: { phone: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newCode !== confirmCode) {
      setError(t("The two codes do not match."));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCode, newCode }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? t("Could not change your code."));
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Could not change your code."),
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="change-code-heading">
        <LanguagePicker />
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1 id="change-code-heading">{t("Choose your code")}</h1>
          <p className="auth-description">
            {t(
              "Your code is still the last six digits of your phone number, which anyone could guess. Pick a new one to finish setting up.",
            )}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="current-code">{t("Current code")}</label>
          <div className="auth-input-wrap">
            <input
              id="current-code"
              type="password"
              autoComplete="current-password"
              inputMode="numeric"
              required
              value={currentCode}
              onChange={(event) => setCurrentCode(event.target.value)}
              placeholder={phone.slice(-6)}
            />
          </div>
          <label htmlFor="new-code">{t("New code")}</label>
          <div className="auth-input-wrap">
            <input
              id="new-code"
              type="password"
              autoComplete="new-password"
              inputMode="numeric"
              pattern="\d{6}"
              required
              value={newCode}
              onChange={(event) => setNewCode(event.target.value)}
              placeholder={t("Six digits")}
            />
          </div>
          <label htmlFor="confirm-code">{t("Repeat new code")}</label>
          <div className="auth-input-wrap">
            <input
              id="confirm-code"
              type="password"
              autoComplete="new-password"
              inputMode="numeric"
              pattern="\d{6}"
              required
              value={confirmCode}
              onChange={(event) => setConfirmCode(event.target.value)}
              placeholder={t("Six digits")}
            />
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? t("Saving…") : t("Save my code")}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <AppVersion />
      </section>
    </main>
  );
}
