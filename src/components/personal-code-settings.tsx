"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAppTransport } from "@/lib/app-transport";

export function PersonalCodeSettings({ phone }: { phone: string }) {
  const { t } = useI18n();
  const transport = useAppTransport();
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newCode !== confirmCode) {
      setError(t("The two codes do not match."));
      return;
    }

    setBusy(true);
    setError("");
    setDone(false);
    try {
      const response = await transport.request("/api/account/code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCode, newCode }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? t("Could not change your code."));
      }
      setCurrentCode("");
      setNewCode("");
      setConfirmCode("");
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not change your code."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card">
      <h3>{t("Change your code")}</h3>
      <p className="text-muted">
        {t("You sign in with {{phone}} and this code.", { phone })}
      </p>
      <fieldset className="preview-fieldset" disabled={transport.preview}>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="settings-current-code">{t("Current code")}</label>
          <div className="auth-input-wrap">
            <input
              id="settings-current-code"
              type="password"
              autoComplete="current-password"
              inputMode="numeric"
              required
              value={currentCode}
              onChange={(event) => setCurrentCode(event.target.value)}
            />
          </div>
          <label htmlFor="settings-new-code">{t("New code")}</label>
          <div className="auth-input-wrap">
            <input
              id="settings-new-code"
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
          <label htmlFor="settings-confirm-code">{t("Repeat new code")}</label>
          <div className="auth-input-wrap">
            <input
              id="settings-confirm-code"
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
          <button className="primary-button" disabled={busy}>
            {busy ? t("Saving…") : t("Save my code")}
          </button>
        </form>
      </fieldset>
      {error && <p className="auth-error">{error}</p>}
      {done && <p className="auth-message">{t("Your code has changed.")}</p>}
    </section>
  );
}
