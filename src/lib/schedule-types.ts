export type RideLeg = "to_event" | "from_event";
export type EventType = "practice" | "game" | "competition";

export type GroupHousehold = {
  id: string;
  groupId: string;
  rosterEntryId: string | null;
  /** Every active adult in the household, joined for display. */
  name: string;
  memberNames: string[];
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type GroupParticipant = {
  id: string;
  groupId: string;
  householdId: string;
  rosterEntryId: string | null;
  name: string;
  photoUrl?: string;
};

export type GroupLocation = {
  id: string;
  groupId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type GroupEvent = {
  id: string;
  groupId: string;
  templateId: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  locationId: string;
  needsTo: boolean;
  needsFrom: boolean;
  eventType: EventType;
  title: string | null;
  changedAt: string | null;
};

export type EventAttendance = {
  eventId: string;
  participantId: string;
  absent: boolean;
  optOutTo: boolean;
  optOutFrom: boolean;
  updatedAt: string;
};

export type RideClaim = {
  id: string;
  eventId: string;
  leg: RideLeg;
  householdId: string;
  driverRosterEntryId: string | null;
  claimedBy: string;
};

export type GroupBreak = {
  id: string;
  groupId: string;
  startsOn: string;
  endsOn: string;
  label: string | null;
};

export type AbsencePeriod = {
  id: string;
  periodGroupId: string;
  groupId: string;
  participantId: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
};

export type ScheduleTemplate = {
  id: string;
  groupId: string;
  weekday: number;
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string | null;
  locationId: string;
  needsTo: boolean;
  needsFrom: boolean;
};

export type GroupSchedule = {
  households: GroupHousehold[];
  participants: GroupParticipant[];
  locations: GroupLocation[];
  events: GroupEvent[];
  attendance: EventAttendance[];
  claims: RideClaim[];
  breaks: GroupBreak[];
  absencePeriods: AbsencePeriod[];
  templates: ScheduleTemplate[];
  currentHouseholdId: string | null;
};
