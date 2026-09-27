import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="auth-page">
      <article className="auth-card legal-copy">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1>Privacy notice</h1>
        </div>
        <p>
          Carpool Together stores information supplied by group organizers and
          members to coordinate private carpools. This may include names, phone
          numbers, group membership, pickup details, ride requests, and driver
          capacity.
        </p>
        <p>
          Phone numbers and group data are used for access control and carpool
          coordination. They are not sold or used for advertising. Access is
          limited by group membership and organizer permissions.
        </p>
        <p>
          Group organizers are responsible for collecting information with
          appropriate consent, keeping rosters current, and removing people who
          should no longer have access. Users should provide only information
          needed for coordination.
        </p>
        <p>
          Data is stored by the application&apos;s hosting and database
          providers. No internet service can guarantee absolute security or
          availability. Contact the group organizer to request correction or
          deletion of group information.
        </p>
        <p>
          This initial notice must be reviewed and updated for the deployed
          service&apos;s operator, jurisdiction, retention practices, and
          contact details before a broad public launch.
        </p>
        <Link className="primary-button" href="/">
          Return to the app
        </Link>
      </article>
    </main>
  );
}
