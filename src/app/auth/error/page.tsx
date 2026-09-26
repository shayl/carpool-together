import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <h1>Sign-in could not be completed</h1>
        <p className="auth-description">
          Return to the sign-in page and try your Google account again.
        </p>
        <Link className="primary-button" href="/">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
