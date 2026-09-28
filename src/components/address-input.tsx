"use client";

import { useEffect, useId, useState } from "react";
import {
  minimumQueryLength,
  type AddressSuggestion,
} from "@/lib/address-suggestions";
import { useI18n } from "@/lib/i18n";

export type AddressValue = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

// Shared address field for venues and household addresses. Suggestions carry
// coordinates, so picking one saves a geocoding round trip later; typing a
// free-text address stays valid and simply leaves coordinates unset.
export function AddressInput({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder,
  required,
  disabled,
  maxLength = 300,
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The query is tracked separately from `value.address` so the effect reacts
  // to typing only, and never to a programmatic value change.
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (query.length < minimumQueryLength) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/address-suggestions?q=${encodeURIComponent(query)}&lang=${locale}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const result = (await response.json()) as {
          suggestions?: AddressSuggestion[];
        };
        setSuggestions(result.suggestions ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        // Ignore aborted or failed lookups; typing still works.
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, locale]);

  function choose(suggestion: AddressSuggestion) {
    onChange({
      address: suggestion.address,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setQuery("");
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
  }

  const visible = open && suggestions.length > 0;

  return (
    <div className="address-input">
      <label>
        {label}
        <input
          className="input"
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          value={value.address}
          placeholder={placeholder}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next.trim());
            if (next.trim().length < minimumQueryLength) setSuggestions([]);
            // Editing by hand invalidates coordinates from an earlier pick.
            onChange({ address: next, latitude: null, longitude: null });
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (!visible) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) =>
                index <= 0 ? suggestions.length - 1 : index - 1,
              );
            } else if (event.key === "Enter" && active >= 0) {
              event.preventDefault();
              choose(suggestions[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </label>
      {visible && (
        <ul className="address-suggestions" id={listId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={
                  index === active
                    ? "address-suggestion address-suggestion-active"
                    : "address-suggestion"
                }
                // onMouseDown so the pick lands before the input blurs.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(suggestion);
                }}
              >
                {suggestion.address}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.latitude !== null && (
        <p className="auth-footnote">{t("Location confirmed on the map.")}</p>
      )}
    </div>
  );
}
