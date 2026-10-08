import { describe, expect, it } from "vitest";

import { currentTotalsByAssignment, describeTotals } from "./totals";

describe("currentTotalsByAssignment", () => {
  it("sums step minutes for two assignments", () => {
    const totals = currentTotalsByAssignment([
      { assignment_id: "assignment-a", estimated_minutes: 30 },
      { assignment_id: "assignment-b", estimated_minutes: 45 },
      { assignment_id: "assignment-a", estimated_minutes: 60 },
    ]);

    expect(totals).toEqual(
      new Map([
        ["assignment-a", 90],
        ["assignment-b", 45],
      ]),
    );
  });
});

describe("describeTotals", () => {
  it("shows the AI and current totals", () => {
    expect(describeTotals({ aiTotal: 150, currentTotal: 180 })).toBe(
      "AI estimate: 2 h 30 min · Your plan: 3 h",
    );
  });

  it("shows when there is no AI total", () => {
    expect(describeTotals({ aiTotal: null, currentTotal: 180 })).toBe(
      "AI estimate: none · Your plan: 3 h",
    );
  });

  it("shows when the current plan is empty", () => {
    expect(describeTotals({ aiTotal: 150, currentTotal: 0 })).toBe(
      "AI estimate: 2 h 30 min · Your plan: not set yet",
    );
  });
});
