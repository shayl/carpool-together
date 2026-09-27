"use client";

import { Check, Copy, Eye, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function GroupPinSettings({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestPin(method: "GET" | "PATCH") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/groups/${groupId}/pin`, { method });
      const result = (await response.json()) as {
        error?: string;
        pin?: string;
      };
      if (!response.ok || !result.pin) {
        throw new Error(result.error ?? t("Could not load the group PIN."));
      }
      setPin(result.pin);
      setCopied(false);
      setConfirmRegenerate(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? t(caught.message)
          : t("Could not load the group PIN."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setError("");
    } catch {
      setError(t("Could not copy the PIN. Select and copy it manually."));
    }
  }

  return (
    <section className="surface-card group-pin-settings">
      <div>
        <h3>{t("Group PIN")}</h3>
        <p className="text-muted">
          {t("Only group owners can reveal or regenerate this PIN.")}
        </p>
      </div>
      {pin ? (
        <>
          <output className="generated-pin" aria-label={t("Group PIN")}>
            {pin}
          </output>
          <button className="secondary-button" type="button" onClick={copyPin}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? t("Copied") : t("Copy PIN")}
          </button>
        </>
      ) : (
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => requestPin("GET")}
        >
          <Eye size={18} />
          {loading ? t("Loading…") : t("Reveal PIN")}
        </button>
      )}
      {!confirmRegenerate ? (
        <button
          className="text-button"
          type="button"
          onClick={() => setConfirmRegenerate(true)}
        >
          <RefreshCw size={16} />
          {t("Generate a new PIN")}
        </button>
      ) : (
        <div className="confirmation-actions">
          <button
            className="danger-button"
            type="button"
            disabled={loading}
            onClick={() => requestPin("PATCH")}
          >
            {loading ? t("Generating…") : t("Invalidate old PIN and generate")}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setConfirmRegenerate(false)}
          >
            {t("Cancel")}
          </button>
        </div>
      )}
      {confirmRegenerate && (
        <p className="text-muted">
          {t("The old PIN will stop working immediately.")}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
