import { describe, expect, it } from "vitest";

import {
  formatTimeOfDay,
  hoursAndMinutesToTotalMinutes,
  parseTimeOfDay,
  settingsSchema,
  totalMinutesToHoursAndMinutes,
  type SettingsInput,
} from "./schema";

const validSettings: SettingsInput = {
  study_window_start: 540,
  study_window_end: 1020,
  max_study_minutes_per_day: 240,
  min_block_minutes: 30,
  max_block_minutes: 90,
  buffer_days: 2,
  timezone: "Test/Zone",
  check_in_time: 1380,
  canvas_feed_url: undefined,
};

function expectValid(overrides: Partial<SettingsInput> = {}) {
  expect(settingsSchema.safeParse({ ...validSettings, ...overrides }).success).toBe(
    true,
  );
}

function expectInvalid(overrides: Partial<Record<keyof SettingsInput, unknown>>) {
  const result = settingsSchema.safeParse({ ...validSettings, ...overrides });
  expect(result.success).toBe(false);

  if (result.success) {
    throw new Error("Expected settings validation to fail.");
  }

  return result.error.issues;
}

describe("settingsSchema", () => {
  it("accepts a study window whose start is before its end", () => {
    expectValid({ study_window_start: 480, study_window_end: 1020 });
  });

  it("rejects a study window whose start is after its end", () => {
    expectInvalid({ study_window_start: 1080, study_window_end: 1020 });
  });

  it("rejects equal study window start and end times", () => {
    expectInvalid({ study_window_start: 600, study_window_end: 600 });
  });

  it("accepts time-of-day boundary values", () => {
    expectValid({
      study_window_start: 0,
      study_window_end: 1439,
      check_in_time: 1439,
    });
  });

  it.each([
    { study_window_start: -1 },
    { study_window_end: 1440 },
    { check_in_time: 600.5 },
  ])("rejects an invalid time-of-day value: %o", (overrides) => {
    expectInvalid(overrides);
  });

  it("accepts a minimum block equal to the maximum block", () => {
    expectValid({ min_block_minutes: 60, max_block_minutes: 60 });
  });

  it("rejects a minimum block greater than the maximum block", () => {
    expectInvalid({ min_block_minutes: 91, max_block_minutes: 90 });
  });

  it("accepts a maximum block equal to the daily maximum", () => {
    expectValid({ max_block_minutes: 240 });
  });

  it("rejects a maximum block greater than the daily maximum", () => {
    expectInvalid({
      max_study_minutes_per_day: 89,
      max_block_minutes: 90,
    });
  });

  it("accepts zero-minute duration values", () => {
    expectValid({
      max_study_minutes_per_day: 0,
      min_block_minutes: 0,
      max_block_minutes: 0,
    });
  });

  it.each([
    { max_study_minutes_per_day: -1 },
    { min_block_minutes: -1 },
    { max_block_minutes: 1.5 },
  ])("rejects an invalid duration: %o", (overrides) => {
    expectInvalid(overrides);
  });

  it.each([0, 7])("accepts buffer-day boundary %s", (bufferDays) => {
    expectValid({ buffer_days: bufferDays });
  });

  it.each([-1, 8, 3.5])("rejects invalid buffer days %s", (bufferDays) => {
    expectInvalid({ buffer_days: bufferDays });
  });

  it("accepts a valid HTTPS Canvas feed URL", () => {
    expectValid({ canvas_feed_url: "https://example.com/calendar" });
  });

  it("rejects an HTTP Canvas feed URL", () => {
    expectInvalid({ canvas_feed_url: "http://example.com/calendar" });
  });

  it("accepts an empty Canvas feed URL as not provided", () => {
    expect(settingsSchema.safeParse({ ...validSettings, canvas_feed_url: "" }).success).toBe(
      true,
    );
  });

  it("accepts a missing Canvas feed URL", () => {
    const settingsWithoutCanvas = { ...validSettings };
    Reflect.deleteProperty(settingsWithoutCanvas, "canvas_feed_url");

    expect(settingsSchema.safeParse(settingsWithoutCanvas).success).toBe(true);
  });

  it("rejects a malformed Canvas feed URL", () => {
    expectInvalid({ canvas_feed_url: "not-a-url" });
  });

  it("does not include a rejected Canvas feed URL in its errors", () => {
    const submittedUrl = "http://example.com/private-calendar";
    const issues = expectInvalid({ canvas_feed_url: submittedUrl });

    expect(issues.map((issue) => issue.message).join(" ")).not.toContain(
      submittedUrl,
    );
  });

  it.each([
    ["study_window_start", "Enter a start time."],
    ["study_window_end", "Enter an end time."],
    ["max_study_minutes_per_day", "Enter a maximum study time."],
    ["min_block_minutes", "Enter a minimum block length."],
    ["max_block_minutes", "Enter a maximum block length."],
    ["buffer_days", "Enter buffer days."],
    ["timezone", "Enter a timezone."],
    ["check_in_time", "Enter a check-in time."],
  ] as const)("uses a plain required message for %s", (field, message) => {
    const issues = expectInvalid({ [field]: null });

    expect(issues.find((issue) => issue.path[0] === field)?.message).toBe(
      message,
    );
  });
});

describe("minute conversion helpers", () => {
  it.each([
    { hours: 0, minutes: 0 },
    { hours: 1, minutes: 30 },
    { hours: 23, minutes: 59 },
  ])("round trips $hours hours and $minutes minutes", ({ hours, minutes }) => {
    const totalMinutes = hoursAndMinutesToTotalMinutes(hours, minutes);

    expect(totalMinutesToHoursAndMinutes(totalMinutes)).toEqual({
      hours,
      minutes,
    });
  });
});

describe("time-of-day conversion", () => {
  it.each([
    ["00:00", 0],
    ["12:00", 720],
    ["23:59", 1439],
    ["12:00:00", 720],
  ])("parses %s as %i minutes", (value, expectedMinutes) => {
    expect(parseTimeOfDay(value)).toBe(expectedMinutes);
  });

  it.each(["", "garbage", "24:00", "12:60"])(
    "rejects %j without returning NaN",
    (value) => {
      const result = parseTimeOfDay(value);

      expect(result).toBeNull();
      expect(Number.isNaN(result)).toBe(false);
    },
  );

  it.each([0, 720, 1439])(
    "round trips %i minutes through the form format",
    (totalMinutes) => {
      expect(parseTimeOfDay(formatTimeOfDay(totalMinutes))).toBe(totalMinutes);
    },
  );

  it("validates a complete object built from form-style strings", () => {
    const formValues = {
      studyWindowStart: "12:00",
      studyWindowEnd: "12:30",
      maximumStudyHours: "5",
      maximumStudyMinutes: "30",
      minimumBlockHours: "1",
      minimumBlockMinutes: "0",
      maximumBlockHours: "2",
      maximumBlockMinutes: "0",
      bufferDays: "5",
      checkInTime: "23:30",
    };
    const result = settingsSchema.safeParse({
      study_window_start: parseTimeOfDay(formValues.studyWindowStart),
      study_window_end: parseTimeOfDay(formValues.studyWindowEnd),
      max_study_minutes_per_day: hoursAndMinutesToTotalMinutes(
        Number(formValues.maximumStudyHours),
        Number(formValues.maximumStudyMinutes),
      ),
      min_block_minutes: hoursAndMinutesToTotalMinutes(
        Number(formValues.minimumBlockHours),
        Number(formValues.minimumBlockMinutes),
      ),
      max_block_minutes: hoursAndMinutesToTotalMinutes(
        Number(formValues.maximumBlockHours),
        Number(formValues.maximumBlockMinutes),
      ),
      buffer_days: Number(formValues.bufferDays),
      timezone: "America/Los_Angeles",
      check_in_time: parseTimeOfDay(formValues.checkInTime),
      canvas_feed_url: "",
    });

    expect(result.success).toBe(true);
  });

  it("uses a plain message when the form start time is empty", () => {
    const result = settingsSchema.safeParse({
      ...validSettings,
      study_window_start: parseTimeOfDay(""),
    });

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected settings validation to fail.");
    }

    const message = result.error.flatten().fieldErrors.study_window_start?.[0];
    expect(message).toBe("Enter a start time.");
    expect(message).not.toMatch(/NaN|expected|received/i);
  });
});
