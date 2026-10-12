import { describe, expect, it } from "vitest";

import {
  buildPlannedBlockLabel,
  buildWarningSentences,
} from "./presentation";

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
