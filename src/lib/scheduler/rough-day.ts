import { formatEstimate } from "../assignments/helpers";
import { APP_TIMEZONE, zonedParts } from "../time/zoned";

export type RoughDayBlock = {
  start: string;
  minutes: number;
  status: string;
};

export type RoughDayWarning = {
  assignmentId: string;
  minutesShort: number;
  firstOverflowDay: string;
};

export type RoughDaySnapshot = {
  blocks: RoughDayBlock[];
  warnings: RoughDayWarning[];
};

export type RoughDaySummary = {
  movedMinutes: number;
  newWarnings: RoughDayWarning[];
};

function laDateKey(instant: string): string | null {
  const date = new Date(instant);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const parts = zonedParts(date, APP_TIMEZONE);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function plannedMinutesOnDate(
  blocks: RoughDayBlock[],
  todayLa: string,
): number {
  return blocks.reduce((total, block) => {
    if (
      block.status !== "planned" ||
      !Number.isInteger(block.minutes) ||
      block.minutes < 0 ||
      laDateKey(block.start) !== todayLa
    ) {
      return total;
    }

    return total + block.minutes;
  }, 0);
}

export function summarizeRoughDay({
  before,
  after,
  todayLa,
}: {
  before: RoughDaySnapshot;
  after: RoughDaySnapshot;
  todayLa: string;
}): RoughDaySummary {
  const beforeWarnings = new Map(
    before.warnings.map((warning) => [warning.assignmentId, warning]),
  );

  return {
    movedMinutes: Math.max(
      0,
      plannedMinutesOnDate(before.blocks, todayLa) -
        plannedMinutesOnDate(after.blocks, todayLa),
    ),
    newWarnings: after.warnings.filter((warning) => {
      const previous = beforeWarnings.get(warning.assignmentId);
      return !previous || warning.minutesShort > previous.minutesShort;
    }),
  };
}

function compactEstimate(minutes: number): string {
  return formatEstimate(minutes)
    .replace(/ (h|min)\b/g, "$1")
    .replace(/min\b/g, "m");
}

export function describeRoughDay(summary: RoughDaySummary): string {
  return summary.movedMinutes > 0
    ? `Moved ${compactEstimate(summary.movedMinutes)} to later days`
    : "Nothing was planned for the rest of today.";
}
