"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
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
            Continue securely with your Google account. No password or email
            link is required.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
        >
          <LogIn size={18} aria-hidden="true" />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-footnote">
          New users are registered after Google verifies their identity.
        </p>
      </section>
    </main>
  );
}
