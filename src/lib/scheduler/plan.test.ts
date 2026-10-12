import { describe, expect, it } from "vitest";

import { planSchedule } from "./plan";
import type {
  BusyInterval,
  ScheduleAssignment,
  ScheduleInput,
} from "./types";

const NOW = new Date("2026-10-12T16:00:00.000Z"); // Monday 9:00 AM LA
const HORIZON = new Date("2026-11-23T08:00:00.000Z");

function assignment(
  partial: Partial<ScheduleAssignment> = {},
): ScheduleAssignment {
  return {
    id: "assignment-a",
    deadline: new Date("2026-10-16T06:59:00.000Z"),
    weight: "medium",
    paceRatio: 1,
    className: "Test Class A",
    title: "Test Assignment A",
    steps: [
      {
        id: "step-a",
        name: "Draft the response",
        order: 1,
        estimatedMinutes: 60,
        percentDone: 0,
      },
    ],
    ...partial,
  };
}

function input(partial: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    now: NOW,
    settings: {
      study_window_start: 8 * 60,
      study_window_end: 22 * 60,
      max_study_minutes_per_day: 240,
      min_block_minutes: 30,
      max_block_minutes: 60,
      buffer_days: 0,
    },
    fixedEvents: [],
    blockedDays: [],
    busyBlocks: [],
    assignments: [assignment()],
    horizonEnd: HORIZON,
    ...partial,
  };
}

function totalMinutes(result: ReturnType<typeof planSchedule>): number {
  return result.blocks.reduce((total, block) => total + block.minutes, 0);
}

function interval(start: string, end: string): BusyInterval {
  return { start: new Date(start), end: new Date(end) };
}

describe("planSchedule", () => {
  it("plans all work when there is plenty of free time", () => {
    const result = planSchedule(input());

    expect(totalMinutes(result)).toBe(60);
    expect(result.warnings).toEqual([]);
    expect(result.blocks[0]).toMatchObject({
      assignmentId: "assignment-a",
      stepId: "step-a",
    });
  });

  it("orders same-deadline assignments by weight and then id", () => {
    const deadline = new Date("2026-10-13T06:59:00.000Z");
    const result = planSchedule(
      input({
        assignments: [
          assignment({ id: "assignment-c", weight: "low", deadline, steps: [{ ...assignment().steps[0], id: "step-c", estimatedMinutes: 30 }] }),
          assignment({ id: "assignment-b", weight: "high", deadline, steps: [{ ...assignment().steps[0], id: "step-b", estimatedMinutes: 30 }] }),
          assignment({ id: "assignment-a", weight: "high", deadline, steps: [{ ...assignment().steps[0], id: "step-a", estimatedMinutes: 30 }] }),
        ],
      }),
    );

    expect(result.blocks.map((block) => block.assignmentId)).toEqual([
      "assignment-a",
      "assignment-b",
      "assignment-c",
    ]);
  });

  it("returns the exact shortfall when work cannot fit", () => {
    const result = planSchedule(
      input({
        settings: {
          ...input().settings,
          study_window_start: 20 * 60,
          study_window_end: 21 * 60,
          max_study_minutes_per_day: 60,
        },
        assignments: [
          assignment({
            deadline: new Date("2026-10-13T04:00:00.000Z"),
            steps: [{ ...assignment().steps[0], estimatedMinutes: 90 }],
          }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(60);
    expect(result.warnings).toEqual([
      {
        assignmentId: "assignment-a",
        minutesShort: 30,
        firstOverflowDay: "2026-10-12",
      },
    ]);
  });

  it("spreads a deadline-tomorrow assignment across today and tomorrow", () => {
    const result = planSchedule(
      input({
        assignments: [
          assignment({
            deadline: new Date("2026-10-14T06:59:00.000Z"),
            steps: [{ ...assignment().steps[0], estimatedMinutes: 120 }],
          }),
        ],
      }),
    );

    expect(new Set(result.blocks.map((block) => block.start.toISOString().slice(0, 10))).size).toBe(2);
    expect(totalMinutes(result)).toBe(120);
  });

  it("skips a blocked Los Angeles day", () => {
    const result = planSchedule(input({ blockedDays: ["2026-10-12"] }));

    expect(result.blocks[0].start.toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });

  it("plans half of a step at 50 percent", () => {
    const result = planSchedule(
      input({
        assignments: [
          assignment({
            steps: [{ ...assignment().steps[0], estimatedMinutes: 90, percentDone: 50 }],
          }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(45);
  });

  it("applies a 1.5 pace ratio and rounds upward to five minutes", () => {
    const result = planSchedule(
      input({
        assignments: [
          assignment({
            paceRatio: 1.5,
            steps: [{ ...assignment().steps[0], estimatedMinutes: 43 }],
          }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(65);
  });

  it("counts busy blocks against the daily maximum", () => {
    const result = planSchedule(
      input({
        settings: { ...input().settings, max_study_minutes_per_day: 120 },
        busyBlocks: [interval("2026-10-12T15:00:00.000Z", "2026-10-12T16:30:00.000Z")],
        assignments: [
          assignment({
            deadline: new Date("2026-10-13T06:59:00.000Z"),
            steps: [{ ...assignment().steps[0], estimatedMinutes: 60 }],
          }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(30);
    expect(result.warnings[0].minutesShort).toBe(30);
  });

  it("uses the real deadline when the buffer would be in the past", () => {
    const result = planSchedule(
      input({
        settings: { ...input().settings, buffer_days: 3 },
        assignments: [
          assignment({ deadline: new Date("2026-10-13T06:59:00.000Z") }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    [
      "fall back",
      new Date("2026-10-31T19:00:00.000Z"),
      new Date("2026-11-02T08:00:00.000Z"),
      "2026-11-01T16:00:00.000Z",
    ],
    [
      "spring forward",
      new Date("2027-03-13T20:00:00.000Z"),
      new Date("2027-03-15T07:00:00.000Z"),
      "2027-03-14T15:00:00.000Z",
    ],
  ])("uses wall-clock study windows across %s", (_name, now, horizonEnd, expectedStart) => {
    const parts = expectedStart.startsWith("2026")
      ? { deadline: new Date("2026-11-02T07:00:00.000Z") }
      : { deadline: new Date("2027-03-15T06:00:00.000Z") };
    const result = planSchedule(
      input({
        now,
        horizonEnd,
        blockedDays: [
          expectedStart.startsWith("2026") ? "2026-10-31" : "2027-03-13",
        ],
        assignments: [assignment(parts)],
      }),
    );

    expect(result.blocks[0].start.toISOString()).toBe(expectedStart);
  });

  it("respects fixed-event padding on both sides", () => {
    const result = planSchedule(
      input({
        fixedEvents: [interval("2026-10-12T17:00:00.000Z", "2026-10-12T18:00:00.000Z")],
        assignments: [assignment({ steps: [{ ...assignment().steps[0], estimatedMinutes: 180 }] })],
      }),
    );
    const paddedStart = new Date("2026-10-12T16:45:00.000Z").getTime();
    const paddedEnd = new Date("2026-10-12T18:15:00.000Z").getTime();

    expect(
      result.blocks.every(
        (block) => block.end.getTime() <= paddedStart || block.start.getTime() >= paddedEnd,
      ),
    ).toBe(true);
  });

  it("allows a final step remainder shorter than the minimum block", () => {
    const result = planSchedule(
      input({
        assignments: [assignment({ steps: [{ ...assignment().steps[0], estimatedMinutes: 35 }] })],
      }),
    );

    expect(result.blocks.map((block) => block.minutes)).toEqual([30, 5]);
  });

  it("keeps ordinary blocks within the configured minimum and maximum", () => {
    const result = planSchedule(
      input({
        assignments: [
          assignment({
            deadline: new Date("2026-10-13T06:59:00.000Z"),
            steps: [{ ...assignment().steps[0], estimatedMinutes: 145 }],
          }),
        ],
      }),
    );

    expect(result.blocks.map((block) => block.minutes)).toEqual([60, 60, 25]);
    expect(result.blocks.every((block) => block.minutes <= 60)).toBe(true);
  });

  it("finishes an earlier step before starting a later step", () => {
    const result = planSchedule(
      input({
        fixedEvents: [
          interval("2026-10-12T16:35:00.000Z", "2026-10-12T17:00:00.000Z"),
        ],
        assignments: [
          assignment({
            steps: [
              { ...assignment().steps[0], id: "step-b", order: 2 },
              { ...assignment().steps[0], id: "step-a", order: 1 },
            ],
          }),
        ],
      }),
    );
    const firstStepEnd = Math.max(
      ...result.blocks
        .filter((block) => block.stepId === "step-a")
        .map((block) => block.end.getTime()),
    );
    const secondStepStart = Math.min(
      ...result.blocks
        .filter((block) => block.stepId === "step-b")
        .map((block) => block.start.getTime()),
    );

    expect(secondStepStart).toBeGreaterThanOrEqual(firstStepEnd);
    expect(secondStepStart).not.toBe(
      new Date("2026-10-12T16:00:00.000Z").getTime(),
    );
  });

  it("rounds the past boundary up to the next 15-minute mark", () => {
    const result = planSchedule(
      input({ now: new Date("2026-10-12T16:07:00.000Z") }),
    );

    expect(result.blocks[0].start.toISOString()).toBe(
      "2026-10-12T16:15:00.000Z",
    );
  });

  it("skips completed steps", () => {
    const result = planSchedule(
      input({
        assignments: [assignment({ steps: [{ ...assignment().steps[0], percentDone: 100 }] })],
      }),
    );

    expect(result).toEqual({ blocks: [], warnings: [] });
  });

  it("warns without planning an overdue assignment", () => {
    const result = planSchedule(
      input({
        assignments: [assignment({ deadline: new Date("2026-10-12T15:59:00.000Z") })],
      }),
    );

    expect(result.blocks).toEqual([]);
    expect(result.warnings).toEqual([
      {
        assignmentId: "assignment-a",
        minutesShort: 60,
        firstOverflowDay: "2026-10-12",
      },
    ]);
  });

  it("treats work beyond the horizon as warning-free carryover", () => {
    const result = planSchedule(
      input({
        horizonEnd: new Date("2026-10-13T07:00:00.000Z"),
        settings: {
          ...input().settings,
          study_window_start: 20 * 60,
          study_window_end: 21 * 60,
          max_study_minutes_per_day: 60,
        },
        assignments: [
          assignment({
            deadline: new Date("2026-10-20T06:59:00.000Z"),
            steps: [{ ...assignment().steps[0], estimatedMinutes: 120 }],
          }),
        ],
      }),
    );

    expect(totalMinutes(result)).toBe(60);
    expect(result.warnings).toEqual([]);
  });

  it("never overlaps busy intervals or its own blocks", () => {
    const busy = [
      interval("2026-10-12T17:00:00.000Z", "2026-10-12T18:00:00.000Z"),
      interval("2026-10-13T19:00:00.000Z", "2026-10-13T20:00:00.000Z"),
    ];
    const result = planSchedule(
      input({
        busyBlocks: busy,
        assignments: [
          assignment({
            steps: [
              { ...assignment().steps[0], estimatedMinutes: 180 },
              { ...assignment().steps[0], id: "step-b", order: 2, estimatedMinutes: 180 },
            ],
          }),
        ],
      }),
    );
    const all = [
      ...busy,
      ...result.blocks.map((block) => ({ start: block.start, end: block.end })),
    ].sort((left, right) => left.start.getTime() - right.start.getTime());

    for (let index = 1; index < all.length; index += 1) {
      expect(all[index].start.getTime()).toBeGreaterThanOrEqual(
        all[index - 1].end.getTime(),
      );
    }
  });

  it("is deterministic across repeated and shuffled inputs", () => {
    const assignments = [
      assignment({ id: "assignment-b", steps: [{ ...assignment().steps[0], id: "step-b" }] }),
      assignment({ id: "assignment-a", steps: [{ ...assignment().steps[0], id: "step-a" }] }),
    ];
    const fixedEvents = [
      interval("2026-10-13T18:00:00.000Z", "2026-10-13T19:00:00.000Z"),
      interval("2026-10-12T18:00:00.000Z", "2026-10-12T19:00:00.000Z"),
    ];
    const first = planSchedule(input({ assignments, fixedEvents }));
    const second = planSchedule(input({ assignments, fixedEvents }));
    const shuffled = planSchedule(
      input({ assignments: [...assignments].reverse(), fixedEvents: [...fixedEvents].reverse() }),
    );

    expect(second).toEqual(first);
    expect(shuffled).toEqual(first);
  });
});
