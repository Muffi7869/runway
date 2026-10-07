import { describe, expect, it } from "vitest";

import {
  APP_TIMEZONE,
  mondayOf,
  syncWindow,
  zonedParts,
  zonedTimeToUtc,
} from "./zoned";

describe("Los Angeles zoned time", () => {
  it("converts Monday midnight on both sides of the 2026 DST change", () => {
    const before = zonedTimeToUtc(
      { year: 2026, month: 10, day: 26, hour: 0, minute: 0 },
      APP_TIMEZONE,
    );
    const after = zonedTimeToUtc(
      { year: 2026, month: 11, day: 2, hour: 0, minute: 0 },
      APP_TIMEZONE,
    );

    expect(before.toISOString()).toBe("2026-10-26T07:00:00.000Z");
    expect(after.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(169);
  });

  it("round trips non-ambiguous zoned parts", () => {
    const local = {
      year: 2026,
      month: 7,
      day: 14,
      hour: 16,
      minute: 35,
    };
    const utc = zonedTimeToUtc(local, APP_TIMEZONE);

    expect(zonedParts(utc, APP_TIMEZONE)).toEqual({
      ...local,
      weekday: 2,
    });
  });

  it("chooses the previous Monday for Sunday and itself for Monday", () => {
    expect(mondayOf({ year: 2026, month: 11, day: 1 })).toEqual({
      year: 2026,
      month: 10,
      day: 26,
    });
    expect(mondayOf({ year: 2026, month: 11, day: 2 })).toEqual({
      year: 2026,
      month: 11,
      day: 2,
    });
  });
});

describe("syncWindow", () => {
  it.each([
    [
      "a Tuesday",
      "2026-10-27T19:00:00.000Z",
      "2026-10-26T07:00:00.000Z",
      "2026-12-07T08:00:00.000Z",
    ],
    [
      "a Sunday night in Los Angeles",
      "2026-11-02T07:59:00.000Z",
      "2026-10-26T07:00:00.000Z",
      "2026-12-07T08:00:00.000Z",
    ],
    [
      "a Monday morning in Los Angeles",
      "2026-11-02T08:01:00.000Z",
      "2026-11-02T08:00:00.000Z",
      "2026-12-14T08:00:00.000Z",
    ],
  ])("builds the six-week window from %s", (_name, now, min, max) => {
    const window = syncWindow(new Date(now));

    expect(window.timeMin.toISOString()).toBe(min);
    expect(window.timeMax.toISOString()).toBe(max);
  });
});
