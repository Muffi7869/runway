import { describe, expect, it } from "vitest";

import { matchClass, parseCourseCode } from "./class-match";

describe("parseCourseCode", () => {
  it.each([
    ["CSE012", { subject: "CSE", number: 12, suffix: "" }],
    ["CSE 12", { subject: "CSE", number: 12, suffix: "" }],
    ["Math 180A", { subject: "MATH", number: 180, suffix: "A" }],
    ["MMW 14", { subject: "MMW", number: 14, suffix: "" }],
  ])("parses %s", (value, expected) => {
    expect(parseCourseCode(value)).toEqual(expected);
  });

  it("does not parse a descriptive class name", () => {
    expect(parseCourseCode("Intro to Computing")).toBeNull();
  });
});

describe("matchClass", () => {
  it.each([
    ["CSE012_FA26_123456", "CSE 12"],
    ["CSE012_FA26_123456", "CSE12"],
    ["MATH180A_FA26_999999", "Math 180A"],
    ["MMW014_FA26_111111", "MMW 14"],
    ["CSE012", "CSE 12"],
  ])("matches %s to %s", (bracketText, name) => {
    expect(matchClass(bracketText, [{ id: "class-a", name }])).toEqual({
      status: "one",
      classId: "class-a",
    });
  });

  it("does not match a suffix mismatch or an unparseable class", () => {
    expect(
      matchClass("MATH180_FA26_999999", [
        { id: "math", name: "Math 180A" },
        { id: "intro", name: "Intro to Computing" },
      ]),
    ).toEqual({ status: "none" });
  });

  it("reports several exact class matches", () => {
    expect(
      matchClass("CSE012_FA26_123456", [
        { id: "class-a", name: "CSE 12" },
        { id: "class-b", name: "CSE012" },
      ]),
    ).toEqual({ status: "several" });
  });

  it("does not match an empty bracket", () => {
    expect(matchClass("", [{ id: "class-a", name: "CSE 12" }])).toEqual({
      status: "none",
    });
  });
});
