export const BUSINESS_TIME_ZONE = "Europe/Berlin";

export const SALES_EXCLUDED_STATUSES = ["REJECTED", "CANCELLED"] as const;
export const OPEN_ORDER_STATUSES = ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] as const;
export const COLLECTED_PAYMENT_STATUS = "PAID";

export type RangePreset = "today" | "7d" | "30d" | "month" | "custom";
export type Granularity = "day" | "week" | "month";

export type BusinessRange = {
  from: string;
  to: string;
  start: Date;
  end: Date;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function berlinDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function calendarDaysInclusive(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Berlin civil time as a UTC instant. DST gaps and overlaps are resolved by the platform time zone database. */
export function berlinInstant(isoDate: string, time = "00:00:00"): Date {
  if (!DATE_PATTERN.test(isoDate) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    throw new Error("Ungültiges Berliner Datum.");
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = desired;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = formatter.formatToParts(new Date(utc));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const observed = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const next = utc + (desired - observed);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

export function businessWindow(from: string, to: string): BusinessRange {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    throw new Error("Der Zeitraum ist ungültig.");
  }
  const days = calendarDaysInclusive(from, to);
  if (days > 366) throw new Error("Der Zeitraum darf höchstens 366 Tage umfassen.");
  return {
    from,
    to,
    start: berlinInstant(from, "00:00:00"),
    end: berlinInstant(addCalendarDays(to, 1), "00:00:00"),
  };
}

export function previousWindow(range: BusinessRange, preset: RangePreset): BusinessRange {
  if (preset === "month") {
    const [year, month, day] = range.from.split("-").map(Number);
    const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));
    const previousYear = previousMonthEnd.getUTCFullYear();
    const previousMonth = previousMonthEnd.getUTCMonth() + 1;
    const lastDay = previousMonthEnd.getUTCDate();
    const from = `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;
    const toDay = Math.min(Number(range.to.slice(8, 10)), lastDay);
    const to = `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(toDay).padStart(2, "0")}`;
    return businessWindow(from, to);
  }
  const days = calendarDaysInclusive(range.from, range.to);
  const to = addCalendarDays(range.from, -1);
  return businessWindow(addCalendarDays(to, 1 - days), to);
}

export function resolveBusinessRange(input: { preset: RangePreset; from?: string; to?: string }, now = new Date()): BusinessRange {
  const today = berlinDate(now);
  if (input.preset === "today") return businessWindow(today, today);
  if (input.preset === "7d") return businessWindow(addCalendarDays(today, -6), today);
  if (input.preset === "30d") return businessWindow(addCalendarDays(today, -29), today);
  if (input.preset === "month") return businessWindow(`${today.slice(0, 8)}01`, today);
  if (!input.from || !input.to) throw new Error("Für einen eigenen Zeitraum werden Anfang und Ende benötigt.");
  return businessWindow(input.from, input.to);
}

export function bucketStarts(range: BusinessRange, granularity: Granularity): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = range.from;
  while (cursor <= range.to) {
    const key = granularity === "month" ? `${cursor.slice(0, 8)}01` : granularity === "week" ? mondayOnOrBefore(cursor) : cursor;
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return keys;
}

function mondayOnOrBefore(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(isoDate, -offset);
}

export function utcTimestamp(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

export function changeRatio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}
