"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function GeneratedGroupPin({
  groupName,
  pin,
  onContinue,
}: {
  groupName: string;
  pin: string;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError(t("Could not copy the PIN. Select and copy it manually."));
    }
  }

  return (
    <div className="generated-pin-card" role="status">
      <div>
        <p className="auth-eyebrow">{t("Group created")}</p>
        <h2>{groupName}</h2>
        <p>
          {t(
            "Save and share this PIN with group members. It will not be shown again.",
          )}
        </p>
      </div>
      <output className="generated-pin" aria-label={t("Generated group PIN")}>
        {pin}
      </output>
      <button className="secondary-button" type="button" onClick={copyPin}>
        {copied ? <Check size={18} /> : <Copy size={18} />}
        {copied ? t("Copied") : t("Copy PIN")}
      </button>
      {copyError && <p className="error">{copyError}</p>}
      <button className="primary-button" type="button" onClick={onContinue}>
        {t("Continue to group")}
      </button>
    </div>
  );
}
