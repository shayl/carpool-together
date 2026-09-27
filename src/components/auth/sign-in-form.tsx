"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
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
      const registering = mode === "register";
      const response = await fetch(registering ? "/api/register" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          pin,
          accessToken,
          ...(registering ? { groupName, memberName } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          result.error ??
            (registering
              ? t("Could not create the group.")
              : t("Sign-in failed.")),
        );
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : mode === "register"
            ? t("Could not create the group.")
            : t("Sign-in failed."),
      );
      setBusy(false);
    }
  }

  function changeMode(nextMode: "sign-in" | "register") {
    setMode(nextMode);
    setError("");
    setPin("");
  }

  const registering = mode === "register";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1 id="sign-in-heading">
            {registering
              ? t("Create your group")
              : t("Sign in to your groups")}
          </h1>
          <p className="auth-description">
            {registering
              ? t(
                  "Start a private group and invite members with their phone number.",
                )
              : t(
                  "Use the phone number on your group roster and the shared group PIN.",
                )}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {registering && (
            <>
              <label htmlFor="group-name">{t("Group name")}</label>
              <div className="auth-input-wrap">
                <input
                  id="group-name"
                  required
                  maxLength={100}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder={t("Neighborhood carpool")}
                />
              </div>
              <label htmlFor="member-name">{t("Your name")}</label>
              <div className="auth-input-wrap">
                <input
                  id="member-name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder={t("Alex Morgan")}
                />
              </div>
            </>
          )}
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
          <p id="phone-hint" className="auth-footnote">
            {t("For US numbers, enter all 10 digits. No +1 needed.")}
          </p>
          <label htmlFor="pin">{t("Group PIN")}</label>
          <div className="auth-input-wrap">
            <input
              id="pin"
              name="pin"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              inputMode="numeric"
              minLength={4}
              maxLength={12}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder={t("Shared group PIN")}
            />
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy
              ? registering
                ? t("Creating group…")
                : t("Signing in…")
              : registering
                ? t("Register and create group")
                : t("Open my groups")}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="auth-switch">
          <span>
            {registering
              ? t("Already belong to a group?")
              : t("Starting a new carpool group?")}
          </span>
          <button
            type="button"
            onClick={() => changeMode(registering ? "sign-in" : "register")}
            disabled={busy}
          >
            {registering ? t("Sign in") : t("Register and create a group")}
          </button>
        </div>
        <p className="auth-footnote">
          {registering
            ? t(
                "By creating a group, you agree to handle member information responsibly. ",
              )
            : t("Ask a group organizer if you do not know the PIN. ")}
          <Link href="/privacy">{t("Privacy notice")}</Link>
        </p>
      </section>
    </main>
  );
}
