"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
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
    if (!accessToken) throw new Error("Could not create a device session.");
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
            (registering ? "Could not create the group." : "Sign-in failed."),
        );
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : mode === "register"
            ? "Could not create the group."
            : "Sign-in failed.",
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
            {registering ? "Create your group" : "Sign in to your groups"}
          </h1>
          <p className="auth-description">
            {registering
              ? "Start a private group and invite members with their phone number."
              : "Use the phone number on your group roster and the shared group PIN."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {registering && (
            <>
              <label htmlFor="group-name">Group name</label>
              <div className="auth-input-wrap">
                <input
                  id="group-name"
                  required
                  maxLength={100}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Neighborhood carpool"
                />
              </div>
              <label htmlFor="member-name">Your name</label>
              <div className="auth-input-wrap">
                <input
                  id="member-name"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder="Alex Morgan"
                />
              </div>
            </>
          )}
          <label htmlFor="phone">Phone number</label>
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
            For US numbers, enter all 10 digits. No +1 needed.
          </p>
          <label htmlFor="pin">Group PIN</label>
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
              placeholder="Shared group PIN"
            />
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy
              ? registering
                ? "Creating group…"
                : "Signing in…"
              : registering
                ? "Register and create group"
                : "Open my groups"}
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
              ? "Already belong to a group?"
              : "Starting a new carpool group?"}
          </span>
          <button
            type="button"
            onClick={() => changeMode(registering ? "sign-in" : "register")}
            disabled={busy}
          >
            {registering ? "Sign in" : "Register and create a group"}
          </button>
        </div>
        <p className="auth-footnote">
          {registering
            ? "By creating a group, you agree to handle member information responsibly. "
            : "Ask a group organizer if you do not know the PIN. "}
          <Link href="/privacy">Privacy notice</Link>
        </p>
      </section>
    </main>
  );
}
