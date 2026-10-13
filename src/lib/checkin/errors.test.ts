import { describe, expect, it } from "vitest";

import { mapCheckinError } from "./errors";

describe("mapCheckinError", () => {
  it("maps RC001 with a safe step detail", () => {
    expect(
      mapCheckinError({
        code: "RC001",
        details: "Test Step A",
        message: "raw database text",
      }),
    ).toBe("That step can't go below its saved progress: Test Step A.");
  });

  it("maps RC002 without exposing raw text", () => {
    expect(
      mapCheckinError({ code: "RC002", message: "raw database text" }),
    ).toBe("Something changed. Refresh the page and try again.");
  });

  it("maps other and null errors to the generic message", () => {
    const expected =
      "Couldn't save the check-in. Check the values and try again.";
    expect(
      mapCheckinError({ code: "RC003", message: "raw database text" }),
    ).toBe(expected);
    expect(mapCheckinError(null)).toBe(expected);
  });

  it("never leaks raw text or undefined", () => {
    for (const message of [
      mapCheckinError({ code: "OTHER", message: "private raw text" }),
      mapCheckinError({ code: "RC001", details: null }),
      mapCheckinError(null),
    ]) {
      expect(message).not.toContain("private raw text");
      expect(message).not.toContain("undefined");
    }
  });
});
