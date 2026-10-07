import { describe, expect, it } from "vitest";

import {
  calendarSelectionSchema,
  MAX_FIXED_CALENDARS,
} from "./calendar-selection";

describe("calendarSelectionSchema", () => {
  it("rejects an empty selection", () => {
    const result = calendarSelectionSchema.safeParse([]);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Pick at least one calendar.",
    );
  });

  it("accepts one calendar id", () => {
    expect(
      calendarSelectionSchema.safeParse(["calendar@example.com"]).success,
    ).toBe(true);
  });

  it("rejects duplicate calendar ids", () => {
    const result = calendarSelectionSchema.safeParse([
      "calendar@example.com",
      "calendar@example.com",
    ]);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.message.includes("once")))
      .toBe(true);
  });

  it("rejects more than the maximum number of calendars", () => {
    const ids = Array.from(
      { length: MAX_FIXED_CALENDARS + 1 },
      (_, index) => `calendar-${index}@example.com`,
    );

    expect(calendarSelectionSchema.safeParse(ids).success).toBe(false);
  });

  it("rejects non-string calendar ids", () => {
    expect(
      calendarSelectionSchema.safeParse(["calendar@example.com", 42]).success,
    ).toBe(false);
  });
});
