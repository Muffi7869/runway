import { z } from "zod";

function minutesSinceMidnight(label: string, requiredMessage: string) {
  return z
    .number({ error: requiredMessage })
    .int(`${label} must be a whole number of minutes.`)
    .min(0, `${label} must be between 0 and 1439 minutes.`)
    .max(1439, `${label} must be between 0 and 1439 minutes.`);
}

function nonnegativeMinutes(label: string, requiredMessage: string) {
  return z
    .number({ error: requiredMessage })
    .int(`${label} must be a whole number of minutes.`)
    .min(0, `${label} must be zero or more minutes.`);
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const optionalCanvasFeedUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .refine(isHttpsUrl, {
      message: "Canvas feed URL must be a valid HTTPS URL.",
    })
    .optional(),
);

export const settingsSchema = z
  .object({
    study_window_start: minutesSinceMidnight(
      "Study window start",
      "Enter a start time.",
    ),
    study_window_end: minutesSinceMidnight(
      "Study window end",
      "Enter an end time.",
    ),
    max_study_minutes_per_day: nonnegativeMinutes(
      "Maximum study time per day",
      "Enter a maximum study time.",
    ),
    min_block_minutes: nonnegativeMinutes(
      "Minimum block time",
      "Enter a minimum block length.",
    ),
    max_block_minutes: nonnegativeMinutes(
      "Maximum block time",
      "Enter a maximum block length.",
    ),
    buffer_days: z
      .number({ error: "Enter buffer days." })
      .int("Buffer days must be a whole number.")
      .min(0, "Buffer days must be between 0 and 7.")
      .max(7, "Buffer days must be between 0 and 7."),
    timezone: z.string({ error: "Enter a timezone." }),
    check_in_time: minutesSinceMidnight(
      "Check-in time",
      "Enter a check-in time.",
    ),
    canvas_feed_url: optionalCanvasFeedUrl,
  })
  .superRefine((settings, context) => {
    if (settings.study_window_start >= settings.study_window_end) {
      context.addIssue({
        code: "custom",
        path: ["study_window_end"],
        message: "Study window start must be before study window end.",
      });
    }

    if (settings.min_block_minutes > settings.max_block_minutes) {
      context.addIssue({
        code: "custom",
        path: ["max_block_minutes"],
        message:
          "Minimum block time must be less than or equal to maximum block time.",
      });
    }

    if (settings.max_block_minutes > settings.max_study_minutes_per_day) {
      context.addIssue({
        code: "custom",
        path: ["max_block_minutes"],
        message:
          "Maximum block time must be less than or equal to maximum study time per day.",
      });
    }
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

export function hoursAndMinutesToTotalMinutes(
  hours: number,
  minutes: number,
): number {
  return hours * 60 + minutes;
}

export function totalMinutesToHoursAndMinutes(totalMinutes: number): {
  hours: number;
  minutes: number;
} {
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return hoursAndMinutesToTotalMinutes(hours, minutes);
}

export function formatTimeOfDay(totalMinutes: number): string {
  const { hours, minutes } = totalMinutesToHoursAndMinutes(totalMinutes);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
