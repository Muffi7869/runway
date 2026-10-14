import {
  APP_TIMEZONE,
  addDays,
  mondayOf,
  zonedParts,
  zonedTimeToUtc,
} from "../time/zoned";

export type AssignmentWeekGroup<T> = {
  thisWeek: T[];
  nextWeek: T[];
  later: T[];
};

export function groupByWeek<T extends { deadline: string }>(
  assignments: readonly T[],
  now: Date,
): AssignmentWeekGroup<T> {
  const currentMonday = mondayOf(zonedParts(now, APP_TIMEZONE));
  const nextMonday = zonedTimeToUtc(
    { ...addDays(currentMonday, 7), hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
  const followingMonday = zonedTimeToUtc(
    { ...addDays(currentMonday, 14), hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
  const result: AssignmentWeekGroup<T> = {
    thisWeek: [],
    nextWeek: [],
    later: [],
  };

  for (const assignment of assignments) {
    const deadline = new Date(assignment.deadline);

    if (deadline < nextMonday) {
      result.thisWeek.push(assignment);
    } else if (deadline < followingMonday) {
      result.nextWeek.push(assignment);
    } else {
      result.later.push(assignment);
    }
  }

  return result;
}
