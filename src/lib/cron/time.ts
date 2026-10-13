import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
} from "../time/zoned";

export function missedCutoff(now: Date): Date {
  const { year, month, day } = zonedParts(now, APP_TIMEZONE);

  return zonedTimeToUtc(
    { year, month, day, hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
}

export function todayBounds(now: Date): { start: Date; end: Date } {
  const { year, month, day } = zonedParts(now, APP_TIMEZONE);
  const tomorrow = addDays({ year, month, day }, 1);

  return {
    start: zonedTimeToUtc(
      { year, month, day, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
    end: zonedTimeToUtc(
      { ...tomorrow, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
  };
}
