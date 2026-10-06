import { z } from "zod";

function minutesSinceMidnight(label: string) {
  return z
    .number()
    .int(`${label} must be a whole number of minutes.`)
    .min(0, `${label} must be between 0 and 1439 minutes.`)
    .max(1439, `${label} must be between 0 and 1439 minutes.`);
}

function nonnegativeMinutes(label: string) {
  return z
    .number()
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
    study_window_start: minutesSinceMidnight("Study window start"),
    study_window_end: minutesSinceMidnight("Study window end"),
    max_study_minutes_per_day: nonnegativeMinutes(
      "Maximum study time per day",
    ),
    min_block_minutes: nonnegativeMinutes("Minimum block time"),
    max_block_minutes: nonnegativeMinutes("Maximum block time"),
    buffer_days: z
      .number()
      .int("Buffer days must be a whole number.")
      .min(0, "Buffer days must be between 0 and 7.")
      .max(7, "Buffer days must be between 0 and 7."),
    timezone: z.string(),
    check_in_time: minutesSinceMidnight("Check-in time"),
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
