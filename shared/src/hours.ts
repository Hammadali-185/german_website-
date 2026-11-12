export const WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type ServiceDay = Weekday | "HOLIDAY";

export type OpeningHour = {
  day: ServiceDay;
  opens: string;
  closes: string;
};

const SHORT_TO_DAY: Record<string, Weekday> = {
  Sun: "SUNDAY",
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
};

export function berlinClock(date: Date): { day: Weekday; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const day = SHORT_TO_DAY[value("weekday")];
  if (!day) throw new Error("Zeitzone konnte nicht gelesen werden.");
  return { day, time: `${value("hour")}:${value("minute")}` };
}

export function isWithinHours(time: string, opens: string, closes: string): boolean {
  return time >= opens && time <= closes;
}

export function isRestaurantOpen(date: Date, hours: OpeningHour[], holiday = false): boolean {
  const clock = berlinClock(date);
  const day: ServiceDay = holiday ? "HOLIDAY" : clock.day;
  const entry = hours.find((hour) => hour.day === day);
  if (!entry) return false;
  return isWithinHours(clock.time, entry.opens, entry.closes);
}
