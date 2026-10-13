import { describe, expect, it } from "vitest";

import { computePace } from "./compute";
import { buildPaceSessions } from "./input";

describe("buildPaceSessions", () => {
  it("assembles multiple sessions and includes done assignments", () => {
    const sessions = buildPaceSessions({
      sessions: [
        {
          id: "session-a",
          actualMinutes: 30,
          assignmentStatus: "active",
        },
        {
          id: "session-b",
          actualMinutes: 60,
          assignmentStatus: "done",
        },
      ],
      sessionSteps: [
        {
          sessionId: "session-a",
          stepId: "step-a",
          before: 0,
          after: 50,
        },
        {
          sessionId: "session-b",
          stepId: "step-b",
          before: 50,
          after: 100,
        },
      ],
      steps: [
        { id: "step-a", estimatedMinutes: 60 },
        { id: "step-b", estimatedMinutes: 120 },
      ],
    });

    expect(sessions).toEqual([
      {
        actualMinutes: 30,
        steps: [{ estimatedMinutes: 60, before: 0, after: 50 }],
      },
      {
        actualMinutes: 60,
        steps: [{ estimatedMinutes: 120, before: 50, after: 100 }],
      },
    ]);
    expect(computePace(sessions)).toBe(1);
  });

  it("keeps zero-progress sessions in the pace input", () => {
    expect(
      buildPaceSessions({
        sessions: [
          {
            id: "session-c",
            actualMinutes: 45,
            assignmentStatus: "dropped",
          },
        ],
        sessionSteps: [],
        steps: [],
      }),
    ).toEqual([{ actualMinutes: 45, steps: [] }]);
  });

  it("ignores progress rows whose step estimate is unavailable", () => {
    expect(
      buildPaceSessions({
        sessions: [
          {
            id: "session-d",
            actualMinutes: 20,
            assignmentStatus: "active",
          },
        ],
        sessionSteps: [
          {
            sessionId: "session-d",
            stepId: "missing-step",
            before: 0,
            after: 25,
          },
        ],
        steps: [],
      }),
    ).toEqual([{ actualMinutes: 20, steps: [] }]);
  });
});
