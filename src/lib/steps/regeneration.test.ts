import { describe, expect, it } from "vitest";

import { isRegenerationLocked } from "./regeneration";

describe("isRegenerationLocked", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])(
    "with progress=%s and blocks=%s returns %s",
    (hasProgress, hasBlocks, expected) => {
      expect(isRegenerationLocked({ hasProgress, hasBlocks })).toBe(expected);
    },
  );
});
