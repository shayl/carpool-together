import { format, startOfWeek } from "date-fns";

export type Destination = "rides" | "family" | "team" | "settings";
export type CalendarDisplay = "week" | "month";

export type NavigationState = {
  destination: Destination;
  calendarDisplay: CalendarDisplay;
  calendarDate: string;
  currentDate: string;
  venueToken: string;
};

const destinations = new Set<Destination>([
  "rides",
  "family",
  "team",
  "settings",
]);

export function navigationStateFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
  now = new Date(),
): NavigationState {
  const tab = searchParams.get("tab");
  const date = searchParams.get("date");

  return {
    destination:
      tab && destinations.has(tab as Destination)
        ? (tab as Destination)
        : "rides",
    calendarDisplay:
      searchParams.get("view") === "month" ? "month" : "week",
    calendarDate:
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    currentDate: format(now, "yyyy-MM-dd"),
    venueToken: searchParams.get("venue") ?? "",
  };
}
