import { formatEstimate } from "../assignments/helpers";
import type { Json } from "../db/database.types";
import { APP_TIMEZONE, zonedParts } from "../time/zoned";

const overflowDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export type AssignmentProgressStep = {
  estimated_minutes: number;
  percent_done: number;
};

export function assignmentProgress(
  steps: ReadonlyArray<AssignmentProgressStep>,
): number {
  const totals = steps.reduce(
    (result, step) => {
      const estimate = Number.isFinite(step.estimated_minutes)
        ? Math.max(0, step.estimated_minutes)
        : 0;
      const percent = Number.isFinite(step.percent_done)
        ? Math.min(100, Math.max(0, step.percent_done))
        : 0;

      return {
        estimated: result.estimated + estimate,
        completed: result.completed + estimate * (percent / 100),
      };
    },
    { estimated: 0, completed: 0 },
  );

  return totals.estimated === 0
    ? 0
    : Math.round((totals.completed / totals.estimated) * 100);
}

function calendarMinute(parts: ReturnType<typeof zonedParts>): number {
  const day = Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000;
  return day * 24 * 60 + parts.hour * 60 + parts.minute;
}

export function nowLineOffset(
  now: Date,
  dayStart: Date,
  pxPerHour: number,
): number {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(dayStart.getTime()) ||
    !Number.isFinite(pxPerHour) ||
    pxPerHour <= 0
  ) {
    return Number.NaN;
  }

  const nowMinute = calendarMinute(zonedParts(now, APP_TIMEZONE));
  const startMinute = calendarMinute(zonedParts(dayStart, APP_TIMEZONE));

  return ((nowMinute - startMinute) / 60) * pxPerHour;
}

export function buildPlannedBlockLabel({
  className,
  assignmentTitle,
  stepName,
}: {
  className: string;
  assignmentTitle: string;
  stepName: string;
}): string {
  return `${className} · ${assignmentTitle} · ${stepName}`;
}

export function limitBannerItems<T>(
  items: readonly T[],
  max = 3,
): { shown: T[]; more: number } {
  const limit = Number.isInteger(max) ? Math.max(0, max) : 3;
  return {
    shown: items.slice(0, limit),
    more: Math.max(0, items.length - limit),
  };
}

export function buildWarningSentences(
  stored: Json | null,
  activeAssignments: ReadonlyArray<{ id: string; title: string }>,
): string[] {
  if (!Array.isArray(stored)) {
    return [];
  }

  const titleById = new Map(
    activeAssignments.map((assignment) => [assignment.id, assignment.title]),
  );

  return stored.flatMap((value) => {
    if (
      !value ||
      Array.isArray(value) ||
      typeof value !== "object" ||
      typeof value.assignmentId !== "string" ||
      typeof value.minutesShort !== "number" ||
      !Number.isInteger(value.minutesShort) ||
      value.minutesShort < 0 ||
      typeof value.firstOverflowDay !== "string"
    ) {
      return [];
    }

    const title = titleById.get(value.assignmentId);
    const date = new Date(`${value.firstOverflowDay}T00:00:00Z`);

    if (!title || !Number.isFinite(date.getTime())) {
      return [];
    }

    return [
      `${title} is ${formatEstimate(value.minutesShort)} short before ${overflowDateFormatter.format(date).replace(",", "")}`,
    ];
  });
}
