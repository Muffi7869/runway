import { APP_TIMEZONE, zonedParts } from "../time/zoned";

export type BadgeBlock = {
  start: string;
  status: string;
};

function dateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  const parts = zonedParts(date, APP_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function countCheckinBadge(
  blocks: readonly BadgeBlock[],
  todayLa: string,
  yesterdayLa: string,
): number {
  return blocks.filter(
    (block) =>
      (block.status === "planned" || block.status === "missed") &&
      [todayLa, yesterdayLa].includes(dateKey(block.start) ?? ""),
  ).length;
}
