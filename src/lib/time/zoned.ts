export const APP_TIMEZONE = "America/Los_Angeles";

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type ZonedDateTime = CalendarDate & {
  hour: number;
  minute: number;
};

export type ZonedParts = ZonedDateTime & {
  weekday: number;
};

const WEEKDAYS = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const existing = formatters.get(timeZone);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat(
    "en-US-u-ca-gregory-nu-latn",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    },
  );
  formatters.set(timeZone, formatter);
  return formatter;
}

function calendarUtcMilliseconds(value: ZonedDateTime): number {
  const date = new Date(0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  date.setUTCHours(value.hour, value.minute, 0, 0);
  return date.getTime();
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values = new Map(
    formatterFor(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAYS.get(values.get("weekday") ?? "");
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  const hour = Number(values.get("hour"));
  const minute = Number(values.get("minute"));

  if (
    weekday === undefined ||
    ![year, month, day, hour, minute].every(Number.isInteger)
  ) {
    throw new Error("Unable to read zoned date parts.");
  }

  return { year, month, day, hour, minute, weekday };
}

export function zonedTimeToUtc(
  value: ZonedDateTime,
  timeZone: string,
): Date {
  const target = calendarUtcMilliseconds(value);
  let candidate = target;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const observed = calendarUtcMilliseconds(parts);
    const correction = target - observed;

    if (correction === 0) {
      return new Date(candidate);
    }

    candidate += correction;
  }

  return new Date(candidate);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day + days);

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function mondayOf(date: CalendarDate): CalendarDate {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  const weekday = value.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  return addDays(date, -daysSinceMonday);
}

export function syncWindow(now: Date): { timeMin: Date; timeMax: Date } {
  const current = zonedParts(now, APP_TIMEZONE);
  const monday = mondayOf(current);
  const endingMonday = addDays(monday, 42);

  return {
    timeMin: zonedTimeToUtc(
      { ...monday, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
    timeMax: zonedTimeToUtc(
      { ...endingMonday, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
  };
}
