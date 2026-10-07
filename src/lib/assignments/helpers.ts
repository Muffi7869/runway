import { z } from "zod";

import { APP_TIMEZONE, zonedParts } from "../time/zoned";

export const DEFAULT_DEADLINE_TIME = "23:59";
export const MAX_SPEC_TEXT_CHARACTERS = 100_000;
export const SPEC_TEXT_TOO_LONG_MESSAGE =
  "Spec text must be 100,000 characters or fewer.";

const CLOCK_CHANGE_ERROR =
  "That date and time doesn't exist because of the clock change. Pick another time.";

const assignmentInputSchema = z.object({
  classId: z.string().uuid("Choose a class."),
  title: z
    .string()
    .trim()
    .min(1, "Enter a title.")
    .max(120, "Title must be 120 characters or fewer."),
  deadlineDate: z
    .string()
    .refine(isValidDateString, "Enter a due date."),
  deadlineTime: z
    .string()
    .refine(isValidTimeString, "Enter a due time."),
  weight: z.enum(["low", "medium", "high"], {
    error: "Choose a weight.",
  }),
  specText: z
    .string()
    .trim()
    .max(MAX_SPEC_TEXT_CHARACTERS, SPEC_TEXT_TOO_LONG_MESSAGE),
});

export type AssignmentInput = {
  classId: string;
  title: string;
  deadlineDate: string;
  deadlineTime: string;
  weight: string;
  specText: string;
};

export type AssignmentInputErrors = Partial<
  Record<keyof AssignmentInput, string>
>;

export type ValidatedAssignment = {
  classId: string;
  title: string;
  deadlineIso: string;
  weight: "low" | "medium" | "high";
  specText: string | null;
};

export type AssignmentValidationResult =
  | { ok: true; value: ValidatedAssignment }
  | { ok: false; errors: AssignmentInputErrors };

export type DeadlineParseResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

type AssignmentListRow = {
  id: string;
  title: string;
  deadline: string;
  status: "active" | "done" | "dropped";
};

function parseDateParts(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(value: string): {
  hour: number;
  minute: number;
} | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function isValidDateString(value: string): boolean {
  return parseDateParts(value) !== null;
}

function isValidTimeString(value: string): boolean {
  return parseTimeParts(value) !== null;
}

function wallClockMilliseconds(value: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): number {
  const date = new Date(0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  date.setUTCHours(value.hour, value.minute, 0, 0);
  return date.getTime();
}

function offsetAt(instant: Date): number {
  return wallClockMilliseconds(zonedParts(instant, APP_TIMEZONE)) - instant.getTime();
}

export function parseDeadline({
  date,
  time,
}: {
  date: string;
  time: string;
}): DeadlineParseResult {
  const dateParts = parseDateParts(date);

  if (!dateParts) {
    return { ok: false, error: "Enter a due date." };
  }

  const timeParts = parseTimeParts(time);

  if (!timeParts) {
    return { ok: false, error: "Enter a due time." };
  }

  const typed = { ...dateParts, ...timeParts };
  const naiveMilliseconds = wallClockMilliseconds(typed);
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const offsets = new Set([
    offsetAt(new Date(naiveMilliseconds - dayMilliseconds)),
    offsetAt(new Date(naiveMilliseconds + dayMilliseconds)),
  ]);
  const candidates = [...offsets]
    .map((offset) => new Date(naiveMilliseconds - offset))
    .filter((candidate) => {
      const parts = zonedParts(candidate, APP_TIMEZONE);

      return (
        parts.year === typed.year &&
        parts.month === typed.month &&
        parts.day === typed.day &&
        parts.hour === typed.hour &&
        parts.minute === typed.minute
      );
    })
    .sort((left, right) => left.getTime() - right.getTime());

  if (candidates.length === 0) {
    return { ok: false, error: CLOCK_CHANGE_ERROR };
  }

  return { ok: true, value: candidates[0].toISOString() };
}

export function deadlineToFormValues(iso: string): {
  date: string;
  time: string;
} {
  const parts = zonedParts(new Date(iso), APP_TIMEZONE);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export function validateAssignmentInput(
  input: AssignmentInput,
  {
    mode,
    now,
    currentDeadlineIso,
  }: {
    mode: "create" | "edit";
    now: Date;
    currentDeadlineIso?: string;
  },
): AssignmentValidationResult {
  const result = assignmentInputSchema.safeParse(input);

  if (!result.success) {
    const errors: AssignmentInputErrors = {};

    for (const issue of result.error.issues) {
      const field = issue.path[0];

      if (typeof field === "string" && !(field in errors)) {
        errors[field as keyof AssignmentInput] = issue.message;
      }
    }

    return { ok: false, errors };
  }

  const unchangedDeadline =
    mode === "edit" &&
    currentDeadlineIso !== undefined &&
    (() => {
      const current = deadlineToFormValues(currentDeadlineIso);
      return (
        current.date === result.data.deadlineDate &&
        current.time === result.data.deadlineTime
      );
    })();

  let deadlineIso: string;

  if (unchangedDeadline) {
    deadlineIso = currentDeadlineIso;
  } else {
    const deadline = parseDeadline({
      date: result.data.deadlineDate,
      time: result.data.deadlineTime,
    });

    if (!deadline.ok) {
      return {
        ok: false,
        errors: { deadlineTime: deadline.error },
      };
    }

    if (new Date(deadline.value).getTime() <= now.getTime()) {
      return {
        ok: false,
        errors: {
          deadlineTime:
            mode === "create"
              ? "Deadline must be in the future."
              : "A changed deadline must be in the future.",
        },
      };
    }

    deadlineIso = deadline.value;
  }

  return {
    ok: true,
    value: {
      classId: result.data.classId,
      title: result.data.title,
      deadlineIso,
      weight: result.data.weight,
      specText: result.data.specText === "" ? null : result.data.specText,
    },
  };
}

export function formatDeadline(iso: string, now: Date): string {
  const deadline = new Date(iso);
  const deadlineYear = zonedParts(deadline, APP_TIMEZONE).year;
  const currentYear = zonedParts(now, APP_TIMEZONE).year;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(deadlineYear === currentYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(deadline);
}

export function formatEstimate(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return "Not broken down yet";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours} h`
    : `${hours} h ${remainingMinutes} min`;
}

export function splitAssignments<T extends AssignmentListRow>(list: T[]): {
  active: T[];
  done: T[];
  dropped: T[];
} {
  const result: { active: T[]; done: T[]; dropped: T[] } = {
    active: [],
    done: [],
    dropped: [],
  };

  for (const assignment of list) {
    result[assignment.status].push(assignment);
  }

  const compare = (left: T, right: T) => {
    const deadlineDifference =
      new Date(left.deadline).getTime() - new Date(right.deadline).getTime();

    return deadlineDifference || left.title.localeCompare(right.title);
  };

  result.active.sort(compare);
  result.done.sort(compare);
  result.dropped.sort(compare);

  return result;
}
