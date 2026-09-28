"use client";

import Link from "next/link";
import { AppVersion } from "@/components/app-version";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <main className="auth-page">
      <article className="auth-card legal-copy">
        <div className="auth-logo" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="auth-eyebrow">Carpool Together</p>
          <h1>{t("Privacy notice")}</h1>
        </div>
        <p>
          {t(
            "Carpool Together stores information supplied by group organizers and members to coordinate private carpools. This may include names, phone numbers, group membership, pickup details, ride requests, and driver capacity.",
          )}
        </p>
        <p>
          {t(
            "Phone numbers and group data are used for access control and carpool coordination. They are not sold or used for advertising. Access is limited by group membership and organizer permissions.",
          )}
        </p>
        <p>
          {t(
            "Group organizers are responsible for collecting information with appropriate consent, keeping rosters current, and removing people who should no longer have access. Users should provide only information needed for coordination.",
          )}
        </p>
        <p>
          {t(
            "Data is stored by the application's hosting and database providers. No internet service can guarantee absolute security or availability. Contact the group organizer to request correction or deletion of group information.",
          )}
        </p>
        <p>
          {t(
            "Address suggestions and map routing use OpenStreetMap data. Address text you type is sent to the OpenStreetMap-based geocoding service to return matching suggestions. Map data is © OpenStreetMap contributors, available under the Open Database License.",
          )}
        </p>
        <p>
          {t(
            "This initial notice must be reviewed and updated for the deployed service's operator, jurisdiction, retention practices, and contact details before a broad public launch.",
          )}
        </p>
        <Link className="primary-button" href="/">
          {t("Return to the app")}
        </Link>
        <AppVersion />
      </article>
    </main>
  );
}
