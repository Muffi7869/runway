import { describe, expect, it } from "vitest";

import {
  addStep,
  fromDraft,
  hasProgress,
  makeStep,
  moveStep,
  nudgeMinutes,
  removeStep,
  sumMinutes,
  toSavePayload,
  validateEditorSteps,
} from "./editor";
import { STEP_LOGGED_WORK_MESSAGE } from "./limits";

function testStep(
  key: string,
  partial: Parameters<typeof makeStep>[0] = {},
) {
  return { ...makeStep(partial), key };
}

describe("step list editing", () => {
  it("adds a step until the 20-step limit and then leaves the list unchanged", () => {
    const nineteen = Array.from({ length: 19 }, (_, index) =>
      testStep(`step-${index + 1}`, { name: `Test Step ${index + 1}` }),
    );
    const twenty = addStep(nineteen);
    const result = addStep(twenty);

    expect(twenty).toHaveLength(20);
    expect(result).toEqual(twenty);
    expect(result).not.toBe(twenty);
  });

  it("blocks removal of a logged-work step with the exact message", () => {
    const steps = [testStep("one", { hasLoggedWork: true })];

    expect(removeStep(steps, "one")).toEqual({
      ok: false,
      error: STEP_LOGGED_WORK_MESSAGE,
    });
  });

  it("removes a step without logged work", () => {
    const steps = [testStep("one"), testStep("two")];

    expect(removeStep(steps, "one")).toEqual({
      ok: true,
      steps: [steps[1]],
    });
    expect(steps).toHaveLength(2);
  });

  it("moves steps up and down without moving past either end", () => {
    const steps = [testStep("one"), testStep("two"), testStep("three")];

    expect(moveStep(steps, "two", "up").map((step) => step.key)).toEqual([
      "two",
      "one",
      "three",
    ]);
    expect(moveStep(steps, "two", "down").map((step) => step.key)).toEqual([
      "one",
      "three",
      "two",
    ]);
    expect(moveStep(steps, "one", "up")).toEqual(steps);
    expect(moveStep(steps, "three", "down")).toEqual(steps);
  });

  it("nudges by five minutes and clamps at 15 and 600", () => {
    expect(nudgeMinutes([testStep("one", { minutes: 30 })], "one", 1)[0].minutes).toBe(35);
    expect(nudgeMinutes([testStep("one", { minutes: 30 })], "one", -1)[0].minutes).toBe(25);
    expect(nudgeMinutes([testStep("one", { minutes: 15 })], "one", -1)[0].minutes).toBe(15);
    expect(nudgeMinutes([testStep("one", { minutes: 600 })], "one", 1)[0].minutes).toBe(600);
  });
});

describe("validateEditorSteps", () => {
  it("accepts a valid list", () => {
    expect(
      validateEditorSteps([testStep("one", { name: "Review notes" })]),
    ).toEqual({ ok: true });
  });

  it("rejects zero and 21 steps with list messages", () => {
    expect(validateEditorSteps([])).toEqual({
      ok: false,
      listError: "Add at least one step.",
      stepErrors: {},
    });
    expect(
      validateEditorSteps(
        Array.from({ length: 21 }, (_, index) =>
          testStep(`step-${index}`, { name: `Test Step ${index + 1}` }),
        ),
      ),
    ).toMatchObject({
      ok: false,
      listError: "A breakdown can have at most 20 steps.",
    });
  });

  it.each(["", "   "])("rejects the blank name %j by step key", (name) => {
    const result = validateEditorSteps([testStep("blank-step", { name })]);

    expect(result).toEqual({
      ok: false,
      stepErrors: {
        "blank-step": { name: "Enter a name for this step." },
      },
    });
  });

  it("accepts a trimmed 60-character name and rejects 61 characters", () => {
    expect(
      validateEditorSteps([
        testStep("sixty", { name: ` ${"A".repeat(60)} ` }),
      ]),
    ).toEqual({ ok: true });

    expect(
      validateEditorSteps([
        testStep("sixty-one", { name: "A".repeat(61) }),
      ]),
    ).toEqual({
      ok: false,
      stepErrors: {
        "sixty-one": {
          name: "Step names must be 60 characters or fewer.",
        },
      },
    });
  });

  it.each([14, 605, 17, 45.5, Number.NaN])(
    "rejects invalid minutes %s by step key",
    (minutes) => {
      const result = validateEditorSteps([
        testStep("bad-minutes", { name: "Review notes", minutes }),
      ]);

      expect(result).toEqual({
        ok: false,
        stepErrors: {
          "bad-minutes": {
            minutes: "Minutes must be 15 to 600, in steps of 5.",
          },
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/NaN|undefined|expected|received/i);
    },
  );
});

describe("step values", () => {
  it("sums finite minutes and ignores NaN", () => {
    expect(
      sumMinutes([
        testStep("one", { minutes: 30 }),
        testStep("two", { minutes: Number.NaN }),
        testStep("three", { minutes: 45 }),
      ]),
    ).toBe(75);
  });

  it("detects percent progress and logged work", () => {
    expect(hasProgress([testStep("none")])).toBe(false);
    expect(hasProgress([testStep("percent", { percentDone: 25 })])).toBe(true);
    expect(hasProgress([testStep("logged", { hasLoggedWork: true })])).toBe(true);
  });

  it("creates a trimmed save payload without editor-only fields", () => {
    const result = toSavePayload([
      testStep("editor-key", {
        id: "00000000-0000-4000-8000-000000000001",
        name: "  Review notes  ",
        minutes: 45,
        percentDone: 50,
      }),
    ]);

    expect(result).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Review notes",
        estimated_minutes: 45,
      },
    ]);
    expect(result[0]).not.toHaveProperty("key");
    expect(result[0]).not.toHaveProperty("percent_done");
  });

  it("converts AI draft steps into new editor steps", () => {
    const result = fromDraft([
      { name: "Review prompt", estimatedMinutes: 30 },
      { name: "Draft response", estimatedMinutes: 60 },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: null,
      name: "Review prompt",
      minutes: 30,
      percentDone: 0,
      hasLoggedWork: false,
    });
    expect(result[0].key).not.toBe(result[1].key);
  });
});
