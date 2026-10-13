import { describe, expect, it } from "vitest";

import {
  describeRoughDay,
  summarizeRoughDay,
  type RoughDaySnapshot,
} from "./rough-day";

const TODAY = "2026-10-12";

function snapshot(
  partial: Partial<RoughDaySnapshot> = {},
): RoughDaySnapshot {
  return { blocks: [], warnings: [], ...partial };
}

describe("rough-day summary", () => {
  it("describes minutes moved off today", () => {
    const summary = summarizeRoughDay({
      before: snapshot({
        blocks: [
          { start: "2026-10-12T17:00:00.000Z", minutes: 90, status: "planned" },
          { start: "2026-10-12T20:00:00.000Z", minutes: 60, status: "planned" },
        ],
      }),
      after: snapshot(),
      todayLa: TODAY,
    });

    expect(summary.movedMinutes).toBe(150);
    expect(describeRoughDay(summary)).toBe("Moved 2h 30m to later days");
  });

  it("reports when nothing was planned", () => {
    const summary = summarizeRoughDay({
      before: snapshot(),
      after: snapshot(),
      todayLa: TODAY,
    });

    expect(describeRoughDay(summary)).toBe(
      "Nothing was planned for the rest of today.",
    );
  });

  it("reports a newly introduced warning", () => {
    const warning = {
      assignmentId: "assignment-a",
      minutesShort: 30,
      firstOverflowDay: "2026-10-15",
    };
    const summary = summarizeRoughDay({
      before: snapshot(),
      after: snapshot({ warnings: [warning] }),
      todayLa: TODAY,
    });

    expect(summary.newWarnings).toEqual([warning]);
  });

  it("reports a worsened warning", () => {
    const summary = summarizeRoughDay({
      before: snapshot({
        warnings: [{ assignmentId: "assignment-a", minutesShort: 30, firstOverflowDay: "2026-10-15" }],
      }),
      after: snapshot({
        warnings: [{ assignmentId: "assignment-a", minutesShort: 60, firstOverflowDay: "2026-10-15" }],
      }),
      todayLa: TODAY,
    });

    expect(summary.newWarnings).toHaveLength(1);
  });

  it("does not report an unchanged warning", () => {
    const warning = {
      assignmentId: "assignment-a",
      minutesShort: 30,
      firstOverflowDay: "2026-10-15",
    };
    const summary = summarizeRoughDay({
      before: snapshot({ warnings: [warning] }),
      after: snapshot({ warnings: [warning] }),
      todayLa: TODAY,
    });

    expect(summary.newWarnings).toEqual([]);
  });

  it("does not count checked-in blocks", () => {
    const summary = summarizeRoughDay({
      before: snapshot({
        blocks: [{ start: "2026-10-12T17:00:00.000Z", minutes: 45, status: "checked_in" }],
      }),
      after: snapshot(),
      todayLa: TODAY,
    });

    expect(summary.movedMinutes).toBe(0);
  });

  it("uses the Los Angeles date at the fall-back edge", () => {
    const summary = summarizeRoughDay({
      before: snapshot({
        blocks: [{ start: "2026-11-02T07:30:00.000Z", minutes: 50, status: "planned" }],
      }),
      after: snapshot(),
      todayLa: "2026-11-01",
    });

    expect(summary.movedMinutes).toBe(50);
  });

  it("never returns negative moved minutes", () => {
    const summary = summarizeRoughDay({
      before: snapshot(),
      after: snapshot({
        blocks: [{ start: "2026-10-12T17:00:00.000Z", minutes: 30, status: "planned" }],
      }),
      todayLa: TODAY,
    });

    expect(summary.movedMinutes).toBe(0);
  });
});
