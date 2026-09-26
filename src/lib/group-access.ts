import bcrypt from "bcryptjs";

export type RosterEntry = {
  group_id: string;
  display_name: string;
  role: "owner" | "admin" | "coordinator" | "member";
};

export async function matchingRosterEntries(
  entries: RosterEntry[],
  pinHashes: Map<string, string | null>,
  pin: string,
) {
  const matches: RosterEntry[] = [];

  for (const entry of entries) {
    const pinHash = pinHashes.get(entry.group_id);
    if (pinHash && (await bcrypt.compare(pin, pinHash))) {
      matches.push(entry);
    }
  }

  return matches;
}
