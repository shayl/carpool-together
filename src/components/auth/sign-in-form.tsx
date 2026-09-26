"use client";

import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage("Check your email and open the secure sign-in link.");
    }
    setBusy(false);
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
            Enter your email and we&apos;ll send you a one-time secure link.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrap">
            <Mail size={19} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          New users are registered when they verify their email.
        </p>
      </section>
    </main>
  );
}
