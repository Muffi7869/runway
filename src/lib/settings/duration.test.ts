import { describe, expect, it } from "vitest";

import { joinMinutes, splitMinutes } from "./duration";

describe("duration controls", () => {
  it.each([
    [0, { hours: 0, minutes: 0 }],
    [59, { hours: 0, minutes: 59 }],
    [60, { hours: 1, minutes: 0 }],
    [90, { hours: 1, minutes: 30 }],
    [1440, { hours: 24, minutes: 0 }],
  ])("splits %i minutes", (total, expected) => {
    expect(splitMinutes(total)).toEqual(expected);
    expect(joinMinutes(expected.hours, expected.minutes)).toBe(total);
  });

  it("rejects invalid and negative input", () => {
    expect(splitMinutes("invalid")).toBeNull();
    expect(splitMinutes(-1)).toBeNull();
    expect(joinMinutes("invalid", 0)).toBeNull();
    expect(joinMinutes(-1, 0)).toBeNull();
    expect(joinMinutes(1, -1)).toBeNull();
  });
});
