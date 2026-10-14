import { describe, expect, it } from "vitest";

import {
  assignmentProgress,
  buildPlannedBlockLabel,
  buildWarningSentences,
  nowLineOffset,
} from "./presentation";
import { APP_TIMEZONE, zonedTimeToUtc } from "../time/zoned";

describe("assignmentProgress", () => {
  it.each([
    [[], 0],
    [[{ estimated_minutes: 60, percent_done: 0 }], 0],
    [[{ estimated_minutes: 60, percent_done: 100 }], 100],
    [
      [
        { estimated_minutes: 60, percent_done: 50 },
        { estimated_minutes: 120, percent_done: 25 },
      ],
      33,
    ],
    [
      [
        { estimated_minutes: 40, percent_done: 25 },
        { estimated_minutes: 80, percent_done: 75 },
      ],
      58,
    ],
  ])("returns %i percent for weighted steps", (steps, expected) => {
    expect(assignmentProgress(steps)).toBe(expected);
  });
});

describe("nowLineOffset", () => {
  const dayStart = zonedTimeToUtc(
    { year: 2026, month: 10, day: 14, hour: 8, minute: 0 },
    APP_TIMEZONE,
  );

  it("returns a negative offset before the visible hours", () => {
    expect(
      nowLineOffset(
        zonedTimeToUtc(
          { year: 2026, month: 10, day: 14, hour: 7, minute: 30 },
          APP_TIMEZONE,
        ),
        dayStart,
        48,
      ),
    ).toBe(-24);
  });

  it("positions a time inside the visible hours", () => {
    expect(
      nowLineOffset(
        zonedTimeToUtc(
          { year: 2026, month: 10, day: 14, hour: 10, minute: 30 },
          APP_TIMEZONE,
        ),
        dayStart,
        48,
      ),
    ).toBe(120);
  });

  it("returns an offset beyond the grid after the visible hours", () => {
    expect(
      nowLineOffset(
        zonedTimeToUtc(
          { year: 2026, month: 10, day: 14, hour: 23, minute: 0 },
          APP_TIMEZONE,
        ),
        dayStart,
        48,
      ),
    ).toBe(720);
  });

  it("uses wall-clock time on the fall-back DST day", () => {
    const dstStart = zonedTimeToUtc(
      { year: 2026, month: 11, day: 1, hour: 8, minute: 0 },
      APP_TIMEZONE,
    );
    const tenAm = zonedTimeToUtc(
      { year: 2026, month: 11, day: 1, hour: 10, minute: 0 },
      APP_TIMEZONE,
    );

    expect(nowLineOffset(tenAm, dstStart, 48)).toBe(96);
  });
});

describe("buildPlannedBlockLabel", () => {
  it("joins the class, assignment, and step names", () => {
    expect(
      buildPlannedBlockLabel({
        className: "Test Class A",
        assignmentTitle: "Test Assignment A",
        stepName: "Draft outline",
      }),
    ).toBe("Test Class A · Test Assignment A · Draft outline");
  });
});

describe("buildWarningSentences", () => {
  it("formats valid warnings for active assignments", () => {
    expect(
      buildWarningSentences(
        [
          {
            assignmentId: "assignment-a",
            minutesShort: 270,
            firstOverflowDay: "2026-10-22",
          },
        ],
        [{ id: "assignment-a", title: "Test Assignment A" }],
      ),
    ).toEqual([
      "Test Assignment A is 4 h 30 min short before Thu Oct 22",
    ]);
  });

  it("ignores stale assignments and malformed stored values", () => {
    expect(
      buildWarningSentences(
        [
          null,
          { assignmentId: "inactive", minutesShort: 30, firstOverflowDay: "2026-10-22" },
          { assignmentId: "assignment-a", minutesShort: "30", firstOverflowDay: "2026-10-22" },
        ],
        [{ id: "assignment-a", title: "Test Assignment A" }],
      ),
    ).toEqual([]);
  });
});
