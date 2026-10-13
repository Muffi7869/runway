import { APP_TIMEZONE, zonedParts } from "../time/zoned";

export const DAY_OFF_REASONS = ["travel", "sick", "other"] as const;
export type DayOffReason = (typeof DAY_OFF_REASONS)[number];

export type DayOffValidationResult =
  | { ok: true; value: { date: string; reason: DayOffReason } }
  | { ok: false; errors: { date?: string; reason?: string } };

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

export function laDateKey(now: Date): string {
  const parts = zonedParts(now, APP_TIMEZONE);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function validateDayOff(
  input: { date: unknown; reason: unknown },
  now: Date,
): DayOffValidationResult {
  const date = typeof input.date === "string" ? input.date : "";
  const reason = typeof input.reason === "string" ? input.reason : "";
  const errors: { date?: string; reason?: string } = {};

  if (!isRealDate(date)) {
    errors.date = "Choose a valid date.";
  } else if (date < laDateKey(now)) {
    errors.date = "Choose today or a future date.";
  }

  if (!DAY_OFF_REASONS.includes(reason as DayOffReason)) {
    errors.reason = "Choose a reason.";
  }

  if (errors.date || errors.reason) {
    return { ok: false, errors };
  }

  return { ok: true, value: { date, reason: reason as DayOffReason } };
}
