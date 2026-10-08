import { parseDeadline } from "../assignments/helpers";
import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
} from "../time/zoned";
import type { CanvasDue } from "./parse";

export type ResolvedDue =
  | { ok: true; iso: string }
  | { ok: false; error: string };

export function resolveDueIso(
  due: CanvasDue,
  timeOverride = "23:59",
): ResolvedDue {
  if (due.kind === "datetime") {
    return { ok: true, iso: due.iso };
  }

  const result = parseDeadline({ date: due.date, time: timeOverride });
  return result.ok
    ? { ok: true, iso: result.value }
    : { ok: false, error: result.error };
}

export function importWindowEnd(now: Date): Date {
  const today = zonedParts(now, APP_TIMEZONE);
  const endingDay = addDays(today, 71);

  return zonedTimeToUtc(
    { ...endingDay, hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
}

export function isInImportWindow(iso: string, now: Date): boolean {
  const instant = new Date(iso).getTime();

  return (
    Number.isFinite(instant) &&
    instant >= now.getTime() &&
    instant < importWindowEnd(now).getTime()
  );
}
