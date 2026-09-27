export type GroupScheduleResource =
  | "absences"
  | "attendance"
  | "breaks"
  | "claims"
  | "events"
  | "households"
  | "locations"
  | "templates";

export function groupResourceUrl(
  groupId: string,
  resource: GroupScheduleResource,
) {
  return `/api/groups/${groupId}/${resource}`;
}
