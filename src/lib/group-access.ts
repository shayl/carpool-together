import bcrypt from "bcryptjs";

export type RosterEntry = {
  id: string;
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

export function membershipsForPhone(entries: RosterEntry[], userId: string) {
  return entries.map((entry) => ({
    group_id: entry.group_id,
    user_id: userId,
    roster_entry_id: entry.id,
    role: entry.role,
    status: "active" as const,
  }));
}
