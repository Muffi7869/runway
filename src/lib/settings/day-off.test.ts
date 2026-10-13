import { describe, expect, it } from "vitest";

import { validateDayOff } from "./day-off";

const NOW = new Date("2026-10-12T16:00:00.000Z");

describe("validateDayOff", () => {
  it.each(["travel", "sick", "other"])("accepts today with reason %s", (reason) => {
    expect(validateDayOff({ date: "2026-10-12", reason }, NOW)).toEqual({
      ok: true,
      value: { date: "2026-10-12", reason },
    });
  });

  it("accepts a future real date", () => {
    expect(validateDayOff({ date: "2026-11-01", reason: "travel" }, NOW).ok).toBe(true);
  });

  it.each(["", "2026-02-30", "not-a-date"])("rejects invalid date %s", (date) => {
    expect(validateDayOff({ date, reason: "other" }, NOW)).toEqual({
      ok: false,
      errors: { date: "Choose a valid date." },
    });
  });

  it("rejects a past date in Los Angeles", () => {
    expect(validateDayOff({ date: "2026-10-11", reason: "sick" }, NOW)).toEqual({
      ok: false,
      errors: { date: "Choose today or a future date." },
    });
  });

  it("rejects an unapproved reason", () => {
    expect(validateDayOff({ date: "2026-10-13", reason: "holiday" }, NOW)).toEqual({
      ok: false,
      errors: { reason: "Choose a reason." },
    });
  });

  it("uses the Los Angeles date near UTC midnight", () => {
    const lateSunday = new Date("2026-11-02T07:30:00.000Z");
    expect(validateDayOff({ date: "2026-11-01", reason: "other" }, lateSunday).ok).toBe(true);
  });
});
