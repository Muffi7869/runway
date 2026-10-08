import { describe, expect, it } from "vitest";

import { mapSaveStepsError } from "./save-errors";

describe("mapSaveStepsError", () => {
  it.each([
    [
      { code: "RS001", details: "Test Step A" },
      "This step has logged work: Test Step A.",
    ],
    [{ code: "RS001", details: "" }, "This step has logged work."],
    [
      { code: "RS004", details: "Test Step B" },
      "This step is already scheduled: Test Step B. It can be removed after the next replan.",
    ],
    [
      { code: "RS004", details: null },
      "This step is already scheduled. It can be removed after the next replan.",
    ],
    [
      { code: "RS002" },
      "This assignment can't be edited. Restore it first, or it no longer exists.",
    ],
    [
      { code: "RS003", message: "invalid input" },
      "Couldn't save the steps. Check them and try again.",
    ],
    [
      { code: "OTHER", message: "violates foreign key constraint" },
      "Couldn't save the steps. Check them and try again.",
    ],
    [
      { message: "violates foreign key constraint" },
      "Couldn't save the steps. Check them and try again.",
    ],
    [null, "Couldn't save the steps. Check them and try again."],
  ])("maps %# to a safe message", (error, expected) => {
    const result = mapSaveStepsError(error);

    expect(result).toBe(expected);
    expect(result).not.toMatch(/undefined|violates foreign key constraint/i);
  });
});
