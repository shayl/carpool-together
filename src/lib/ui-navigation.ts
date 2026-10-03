export const teamSections = ["schedule", "people", "places", "balance"] as const;
export type TeamSection = (typeof teamSections)[number];
export const settingsSections = ["preferences", "code", "about", "help"] as const;
export type SettingsSection = (typeof settingsSections)[number];

export function teamSectionFromParams(params: Pick<URLSearchParams, "get">): TeamSection {
  const value = params.get("team");
  return teamSections.find((section) => section === value) ??
    (params.get("venue") ? "places" : "schedule");
}

export function settingsSectionFromParams(params: Pick<URLSearchParams, "get">): SettingsSection | null {
  return settingsSections.find((section) => section === params.get("settings")) ?? null;
}

export function availableGroupId(ids: string[], requested: string | null) {
  return ids.find((id) => id === requested) ?? ids[0];
}
