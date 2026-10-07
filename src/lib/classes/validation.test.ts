import { describe, expect, it } from "vitest";

import { validateClassInput } from "./validation";

describe("validateClassInput", () => {
  it("accepts and trims a class name with a palette color", () => {
    expect(validateClassInput("  Test Class A  ", "blue")).toEqual({
      success: true,
      data: { name: "Test Class A", color: "blue" },
    });
  });

  it.each(["", "   "])("rejects an empty class name", (name) => {
    expect(validateClassInput(name, "blue")).toEqual({
      success: false,
      error: "Class name is required.",
    });
  });

  it("rejects a color outside the fixed palette", () => {
    expect(validateClassInput("Test Class A", "not-a-color")).toEqual({
      success: false,
      error: "Choose a valid class color.",
    });
  });
});
