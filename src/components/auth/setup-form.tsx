"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function SetupForm() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } =
        await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Could not create a device session.");

      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          bootstrapSecret,
          groupName,
          memberName,
          phone,
          pin,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Setup failed.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="setup-heading">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">One-time setup</p>
          <h1 id="setup-heading">Create your first group</h1>
          <p className="auth-description">
            Add the first organizer and choose the shared group PIN.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="group-name">Group name</label>
          <div className="auth-input-wrap">
            <input
              id="group-name"
              required
              maxLength={100}
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Rainier Swim Club"
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
          <label htmlFor="setup-phone">Your phone number</label>
          <div className="auth-input-wrap">
            <input
              id="setup-phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <label htmlFor="setup-pin">Shared group PIN</label>
          <div className="auth-input-wrap">
            <input
              id="setup-pin"
              required
              type="password"
              inputMode="numeric"
              minLength={4}
              maxLength={12}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="4 to 12 characters"
            />
          </div>
          <label htmlFor="setup-secret">Deployment setup secret</label>
          <div className="auth-input-wrap">
            <input
              id="setup-secret"
              required
              type="password"
              autoComplete="off"
              value={bootstrapSecret}
              onChange={(event) => setBootstrapSecret(event.target.value)}
              placeholder="From .env.local"
            />
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Creating group…" : "Create group"}
          </button>
        </form>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          By setting up a group, you agree to handle roster information
          responsibly. <Link href="/privacy">Privacy notice</Link>
        </p>
      </section>
    </main>
  );
}
