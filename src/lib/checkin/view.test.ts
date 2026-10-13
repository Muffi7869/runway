import { describe, expect, it } from "vitest";

import {
  buildCheckinView,
  clampMinutes,
  percentChoices,
  type CheckinStepInput,
} from "./view";

const activeSteps: CheckinStepInput[] = [
  {
    id: "step-a",
    assignmentId: "assignment-a",
    assignmentStatus: "active",
    assignmentTitle: "Test Assignment A",
    className: "Test Class A",
    classColor: "blue",
    name: "Test Step A",
    order: 1,
    percentDone: 25,
  },
  {
    id: "step-b",
    assignmentId: "assignment-a",
    assignmentStatus: "active",
    assignmentTitle: "Test Assignment A",
    className: "Test Class A",
    classColor: "blue",
    name: "Test Step B",
    order: 2,
    percentDone: 100,
  },
];

describe("buildCheckinView", () => {
  it("groups yesterday and today planned or missed work", () => {
    const groups = buildCheckinView({
      blocks: [
        {
          id: "block-a",
          stepId: "step-a",
          start: "2026-10-12T02:00:00Z",
          plannedMinutes: 30,
          status: "missed",
        },
        {
          id: "block-b",
          stepId: "step-a",
          start: "2026-10-12T19:00:00Z",
          plannedMinutes: 45,
          status: "planned",
        },
      ],
      steps: activeSteps,
      sessionsToday: [],
      todayLa: "2026-10-12",
      yesterdayLa: "2026-10-11",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      assignmentId: "assignment-a",
      blockIds: ["block-a", "block-b"],
      minutesDefault: 75,
      alreadyCheckedIn: false,
    });
    expect(groups[0].steps).toEqual([
      {
        stepId: "step-a",
        name: "Test Step A",
        order: 1,
        storedPercent: 25,
        plannedToday: true,
      },
    ]);
  });

  it("shows today's checked-in work and uses existing session minutes", () => {
    const groups = buildCheckinView({
      blocks: [
        {
          id: "block-c",
          stepId: "step-a",
          start: "2026-10-12T20:00:00Z",
          plannedMinutes: 60,
          status: "checked_in",
        },
      ],
      steps: activeSteps,
      sessionsToday: [{ assignmentId: "assignment-a", actualMinutes: 35 }],
      todayLa: "2026-10-12",
      yesterdayLa: "2026-10-11",
    });

    expect(groups[0].alreadyCheckedIn).toBe(true);
    expect(groups[0].minutesDefault).toBe(35);
    expect(groups[0].blockIds).toEqual([]);
  });

  it("excludes blocks from non-active assignments", () => {
    const groups = buildCheckinView({
      blocks: [
        {
          id: "block-d",
          stepId: "step-d",
          start: "2026-10-12T20:00:00Z",
          plannedMinutes: 60,
          status: "planned",
        },
      ],
      steps: [
        {
          ...activeSteps[0],
          id: "step-d",
          assignmentId: "assignment-d",
          assignmentStatus: "done",
        },
      ],
      sessionsToday: [],
      todayLa: "2026-10-12",
      yesterdayLa: "2026-10-11",
    });

    expect(groups).toEqual([]);
  });
});

describe("percentChoices", () => {
  it("disables every choice below stored progress", () => {
    expect(percentChoices(50)).toEqual([
      { value: 0, disabled: true },
      { value: 25, disabled: true },
      { value: 50, disabled: false },
      { value: 75, disabled: false },
      { value: 100, disabled: false },
    ]);
  });
});

describe("clampMinutes", () => {
  it("rounds and clamps minutes to 0 through 720", () => {
    expect(clampMinutes(-1)).toBe(0);
    expect(clampMinutes(40.6)).toBe(41);
    expect(clampMinutes(900)).toBe(720);
    expect(clampMinutes(Number.NaN)).toBe(0);
  });
});
