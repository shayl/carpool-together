import { addDays, format, startOfWeek } from "date-fns";
import { z } from "zod";
import type { AppAccount, AppFamily, AppGroup } from "./app-data";
import { rideState } from "./schedule-state";

export function previewEnabled(environment: string | undefined) {
  return environment === "development";
}

export function createPreviewAccount(): AppAccount {
  return {
    id: "demo-account",
    phone: "+12025550102",
    displayName: "Sam Morgan",
    familyId: "morgan",
  };
}

export function createPreviewFamily(): AppFamily {
  return {
    id: "morgan",
    name: "Morgan",
    address: "4821 Maple Grove Lane, Bellevue, WA",
    latitude: null,
    longitude: null,
    riders: [{ id: "rowan", name: "Rowan Morgan" }],
  };
}

export function createPreviewGroups(now: Date): AppGroup[] {
  const week = startOfWeek(now, { weekStartsOn: 1 });
  const groupId = "demo-meadow";
  const date = (offset: number) => format(addDays(week, offset), "yyyy-MM-dd");
  const group: AppGroup = {
    id: groupId,
    name: "Meadow club",
    shortName: "MC",
    accent: "#5b4bdb",
    role: "owner",
    canManageRoster: true,
    currentRosterEntryId: "sam",
    currentMemberName: "Sam Morgan",
    roster: [
      { id: "alex", displayName: "Alex Morgan", householdId: "morgan", role: "member", active: true, phone: "202-555-0101" },
      { id: "sam", displayName: "Sam Morgan", householdId: "morgan", role: "owner", active: true, phone: "202-555-0102" },
      { id: "jamie", displayName: "Jamie Lee", householdId: "lee", role: "admin", active: true, phone: "202-555-0103" },
      { id: "casey", displayName: "Casey Rivera", householdId: "rivera", role: "member", active: true, phone: "202-555-0104" },
    ],
    schedule: {
      currentHouseholdId: "morgan",
      households: [
        { id: "morgan", groupId, rosterEntryId: "sam", name: "Alex & Sam Morgan", memberNames: ["Alex Morgan", "Sam Morgan"], address: "10 Sample Lane", latitude: null, longitude: null },
        { id: "lee", groupId, rosterEntryId: "jamie", name: "Jamie Lee", memberNames: ["Jamie Lee"], address: "20 Example Street", latitude: null, longitude: null },
        { id: "rivera", groupId, rosterEntryId: "casey", name: "Casey Rivera", memberNames: ["Casey Rivera"], address: "30 Demo Avenue", latitude: null, longitude: null },
      ],
      participants: [
        { id: "riley", groupId, householdId: "morgan", rosterEntryId: null, name: "Riley Morgan" },
        { id: "avery", groupId, householdId: "morgan", rosterEntryId: null, name: "Avery Morgan" },
        { id: "noah", groupId, householdId: "lee", rosterEntryId: null, name: "Noah Lee" },
        { id: "emma", groupId, householdId: "rivera", rosterEntryId: null, name: "Emma Rivera" },
      ],
      locations: [{ id: "park", groupId, name: "Meadow community sports centre", address: "100 Sample Park Road", latitude: null, longitude: null }],
      events: [2, 4, 5].map((offset, index) => ({
        id: `demo-event-${index}`, groupId, templateId: null, date: date(offset),
        startTime: index === 2 ? "09:30" : "17:00", endTime: index === 2 ? "12:00" : "18:30",
        locationId: "park", needsTo: true, needsFrom: true,
        eventType: index === 2 ? "game" : "practice",
        title: index === 2 ? "Weekend friendly match" : "After-school practice",
        changedAt: null,
      })),
      claims: [
        { id: "demo-claim-1", eventId: "demo-event-0", leg: "to_event", householdId: "morgan", driverRosterEntryId: "sam", claimedBy: "demo" },
        { id: "demo-claim-2", eventId: "demo-event-1", leg: "to_event", householdId: "lee", driverRosterEntryId: "jamie", claimedBy: "demo" },
      ],
      attendance: [], breaks: [], absencePeriods: [], templates: [],
    },
  };
  const other: AppGroup = {
    ...structuredClone(group),
    id: "demo-neighborhood",
    name: "Neighborhood outings",
    shortName: "NO",
    role: "member",
    canManageRoster: false,
  };
  other.schedule = {
    ...other.schedule,
    households: other.schedule.households.map((item) => ({ ...item, groupId: other.id })),
    participants: other.schedule.participants.map((item) => ({ ...item, groupId: other.id })),
    locations: other.schedule.locations.map((item) => ({ ...item, groupId: other.id })),
    events: other.schedule.events.map((item) => ({ ...item, groupId: other.id })),
  };
  other.roster = other.roster.map((member) => member.id === other.currentRosterEntryId ? { ...member, role: "member" } : member);
  return [group, other];
}

const claimInput = z.object({ eventId: z.string(), leg: z.enum(["to_event", "from_event"]), driverRosterEntryId: z.string().optional() });
const attendanceInput = z.object({
  eventId: z.string(), participantId: z.string(),
  absent: z.boolean(), optOutTo: z.boolean(), optOutFrom: z.boolean(),
});

export function applyPreviewRequest(group: AppGroup, resource: string, method: string, body: unknown): AppGroup {
  const schedule = group.schedule;
  if (resource === "claims" && (method === "POST" || method === "DELETE")) {
    const input = claimInput.parse(body);
    const event = schedule.events.find((item) => item.id === input.eventId);
    if (!event) throw new Error("Event not found.");
    if (method === "DELETE") return {
      ...group,
      schedule: { ...schedule, claims: schedule.claims.filter((item) => item.eventId !== input.eventId || item.leg !== input.leg) },
    };
    const ride = rideState(schedule, event, input.leg);
    if (!ride.active) throw new Error("That ride leg is not required.");
    if (ride.claim) throw new Error("That ride leg has already been claimed.");
    const driver = group.roster.find((item) => item.id === input.driverRosterEntryId && item.active && item.householdId);
    if (!driver?.householdId) throw new Error("That driver is not available.");
    return {
      ...group,
      schedule: { ...schedule, claims: [...schedule.claims, {
        id: `demo-${input.eventId}-${input.leg}`, eventId: input.eventId, leg: input.leg,
        householdId: driver.householdId, driverRosterEntryId: driver.id, claimedBy: "demo",
      }] },
    };
  }
  if (resource === "attendance" && method === "PUT") {
    const input = attendanceInput.parse(body);
    if (!schedule.events.some((item) => item.id === input.eventId) ||
      !schedule.participants.some((item) => item.id === input.participantId)) throw new Error("Participant not found.");
    return {
      ...group,
      schedule: { ...schedule, attendance: [
        ...schedule.attendance.filter((item) => item.eventId !== input.eventId || item.participantId !== input.participantId),
        { ...input, updatedAt: new Date().toISOString() },
      ] },
    };
  }
  throw new Error("Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.");
}
