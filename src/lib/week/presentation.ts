import { formatEstimate } from "../assignments/helpers";
import type { Json } from "../db/database.types";

const overflowDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

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
