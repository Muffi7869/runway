import { describe, expect, it } from "vitest";

import { computePace, describePace, PACE_MAX, PACE_MIN } from "./compute";

describe("computePace", () => {
  it("returns 1.0 with no sessions", () => {
    expect(computePace([])).toBe(1);
  });

  it("computes a pace below 1 for faster work", () => {
    expect(
      computePace([
        {
          actualMinutes: 30,
          steps: [{ estimatedMinutes: 60, before: 0, after: 100 }],
        },
      ]),
    ).toBe(0.75);
  });

  it("computes a pace above 1 for slower work", () => {
    expect(
      computePace([
        {
          actualMinutes: 120,
          steps: [{ estimatedMinutes: 60, before: 0, after: 100 }],
        },
      ]),
    ).toBe(1.5);
  });

  it("clamps pace at the lower bound", () => {
    expect(
      computePace([
        {
          actualMinutes: 0,
          steps: [{ estimatedMinutes: 600, before: 0, after: 100 }],
        },
      ]),
    ).toBe(PACE_MIN);
  });

  it("clamps pace at the upper bound", () => {
    expect(computePace([{ actualMinutes: 600, steps: [] }])).toBe(PACE_MAX);
  });

  it("counts minutes from a session with no progress", () => {
    expect(computePace([{ actualMinutes: 60, steps: [] }])).toBe(2);
  });

  it("combines progress across multiple steps", () => {
    expect(
      computePace([
        {
          actualMinutes: 90,
          steps: [
            { estimatedMinutes: 60, before: 0, after: 50 },
            { estimatedMinutes: 90, before: 0, after: 100 },
          ],
        },
      ]),
    ).toBe(0.83);
  });

  it("combines two sessions", () => {
    expect(
      computePace([
        {
          actualMinutes: 40,
          steps: [{ estimatedMinutes: 80, before: 0, after: 25 }],
        },
        {
          actualMinutes: 80,
          steps: [{ estimatedMinutes: 80, before: 25, after: 75 }],
        },
      ]),
    ).toBe(1.5);
  });

  it("rounds to two decimal places", () => {
    expect(
      computePace([
        {
          actualMinutes: 43,
          steps: [{ estimatedMinutes: 37, before: 0, after: 100 }],
        },
      ]),
    ).toBe(1.06);
  });

  it("treats non-finite and negative inputs as zero", () => {
    const result = computePace([
      {
        actualMinutes: Number.NaN,
        steps: [
          {
            estimatedMinutes: Number.POSITIVE_INFINITY,
            before: -25,
            after: Number.NaN,
          },
        ],
      },
    ]);

    expect(result).toBe(1);
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("describePace", () => {
  it("describes slower work with exact wording", () => {
    expect(describePace(1.35)).toBe(
      "Pace: 1.35× — you take about 35% longer than estimated",
    );
  });

  it("describes faster work with exact wording", () => {
    expect(describePace(0.8)).toBe(
      "Pace: 0.80× — you take about 20% less time than estimated",
    );
  });

  it("describes exact estimates with exact wording", () => {
    expect(describePace(1)).toBe(
      "Pace: 1.00× — right on your estimates",
    );
  });
});
