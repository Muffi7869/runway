import { describe, expect, it } from "vitest";

import {
  hoursAndMinutesToTotalMinutes,
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
