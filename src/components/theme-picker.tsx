"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const choices: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: "system", label: "Match device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemePicker() {
  const { t } = useI18n();
  const { choice, setTheme } = useTheme();

  return (
    <div className="ride-filters theme-picker" role="group" aria-label={t("Theme")}>
      {choices.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          onClick={() => setTheme(value)}
        >
          <Icon size={16} aria-hidden="true" />
          {t(label)}
        </button>
      ))}
    </div>
  );
}
