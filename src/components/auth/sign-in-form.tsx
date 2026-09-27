"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
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

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin, accessToken }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Sign-in failed.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1 id="sign-in-heading">Sign in to your groups</h1>
          <p className="auth-description">
            Use the phone number on your group roster and the shared group PIN.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
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
            {busy ? "Signing in…" : "Open my groups"}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          Ask a group organizer if you do not know the PIN.{" "}
          <Link href="/privacy">Privacy notice</Link>
        </p>
      </section>
    </main>
  );
}
