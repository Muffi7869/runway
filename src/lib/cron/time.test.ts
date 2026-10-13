import { describe, expect, it } from "vitest";

import { missedCutoff, todayBounds } from "./time";

describe("cron Los Angeles day boundaries", () => {
  it.each([
    ["a PDT day", "2026-10-12T18:00:00.000Z", "2026-10-12T07:00:00.000Z"],
    ["fall-back day", "2026-11-01T20:00:00.000Z", "2026-11-01T07:00:00.000Z"],
    ["spring-forward day", "2027-03-14T20:00:00.000Z", "2027-03-14T08:00:00.000Z"],
  ])("finds real local midnight on %s", (_name, now, expected) => {
    expect(missedCutoff(new Date(now)).toISOString()).toBe(expected);
  });

  it("uses a 25-hour day across fall back", () => {
    const bounds = todayBounds(new Date("2026-11-01T20:00:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("uses a 23-hour day across spring forward", () => {
    const bounds = todayBounds(new Date("2027-03-14T20:00:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2027-03-14T08:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2027-03-15T07:00:00.000Z");
  });
});
