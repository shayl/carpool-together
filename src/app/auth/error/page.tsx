import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <h1>That sign-in link did not work</h1>
        <p className="auth-description">
          The link may have expired or already been used. Request a new one to
          continue.
        </p>
        <Link className="primary-button" href="/">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
