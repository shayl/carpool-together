"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppVersion } from "@/components/app-version";
import { LanguagePicker, useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function anonymousAccessToken() {
    const supabase = createClient();
    let { data } = await supabase.auth.getSession();

    if (data.session && !data.session.user.is_anonymous) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      data = { session: null };
    }

    if (!data.session) {
      const result = await supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
      data = { session: result.data.session };
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error(t("Could not create a device session."));
    return accessToken;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const accessToken = await anonymousAccessToken();
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, accessToken }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? t("Sign-in failed."));
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("Sign-in failed."),
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <LanguagePicker />
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1 id="sign-in-heading">{t("Sign in")}</h1>
          <p className="auth-description">
            {t("Use your phone number and your personal code.")}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="phone">{t("Phone number")}</label>
          <div className="auth-input-wrap">
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <p className="auth-footnote">
            {t("For US numbers, enter all 10 digits. No +1 needed.")}
          </p>
          <label htmlFor="code">{t("Personal code")}</label>
          <div className="auth-input-wrap">
            <input
              id="code"
              name="code"
              type="password"
              autoComplete="current-password"
              inputMode="numeric"
              minLength={4}
              maxLength={12}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t("Six-digit code")}
            />
          </div>
          <p className="auth-footnote">
            {t(
              "Signing in for the first time? Your code is the last six digits of this phone number.",
            )}
          </p>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? t("Signing in…") : t("Open my rides")}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          {t("An organizer adds your phone number to their group. ")}
          <Link href="/privacy">{t("Privacy notice")}</Link>
        </p>
        <AppVersion />
      </section>
    </main>
  );
}
