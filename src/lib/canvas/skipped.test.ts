import { describe, expect, it } from "vitest";

import { describeSkipped } from "./skipped";

const zero = {
  outsideWindow: 0,
  notAssignment: 0,
  unsupportedTime: 0,
  unreadable: 0,
};

describe("describeSkipped", () => {
  it("returns null when nothing was skipped", () => {
    expect(describeSkipped(zero)).toBeNull();
  });

  it.each([
    [
      { outsideWindow: 1 },
      "Not shown: 1 outside the date window.",
    ],
    [
      { unsupportedTime: 1 },
      "Not shown: 1 with an unsupported time format.",
    ],
    [{ unreadable: 1 }, "Not shown: 1 that couldn't be read."],
    [{ notAssignment: 1 }, "Not shown: 1 not assignments."],
  ])("describes one non-zero part", (part, expected) => {
    expect(describeSkipped({ ...zero, ...part })).toBe(expected);
  });

  it("describes all parts in the required order", () => {
    expect(
      describeSkipped({
        outsideWindow: 3,
        unsupportedTime: 1,
        unreadable: 2,
        notAssignment: 4,
      }),
    ).toBe(
      "Not shown: 3 outside the date window, 1 with an unsupported time format, 2 that couldn't be read, 4 not assignments.",
    );
  });
});
