import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEADLINE_TIME,
  deadlineToFormValues,
  formatDeadline,
  formatEstimate,
  parseDeadline,
  splitAssignments,
  validateAssignmentInput,
  type AssignmentInput,
} from "./helpers";

const TEST_CLASS_ID = "11111111-1111-4111-8111-111111111111";

const validInput: AssignmentInput = {
  classId: TEST_CLASS_ID,
  title: "Test Assignment A",
  deadlineDate: "2026-10-09",
  deadlineTime: "23:59",
  weight: "medium",
  specText: "Made-up assignment details.",
};

const createOptions = {
  mode: "create" as const,
  now: new Date("2026-10-09T12:00:00.000Z"),
};

function validate(
  overrides: Partial<AssignmentInput> = {},
  options: Parameters<typeof validateAssignmentInput>[1] = createOptions,
) {
  return validateAssignmentInput({ ...validInput, ...overrides }, options);
}

function expectFieldError(
  field: keyof AssignmentInput,
  message: string,
  overrides: Partial<AssignmentInput>,
) {
  const result = validate(overrides);
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected assignment validation to fail.");
  }

  expect(result.errors[field]).toBe(message);
}

describe("parseDeadline", () => {
  it.each([
    ["2026-10-09", "23:59", "2026-10-10T06:59:00.000Z"],
    ["2026-11-02", "23:59", "2026-11-03T07:59:00.000Z"],
    ["2026-11-01", "00:59", "2026-11-01T07:59:00.000Z"],
    ["2026-11-01", "02:00", "2026-11-01T10:00:00.000Z"],
  ])("parses %s %s to %s", (date, time, expected) => {
    expect(parseDeadline({ date, time })).toEqual({
      ok: true,
      value: expected,
    });
  });

  it("chooses the earlier instant for an ambiguous fall-back time", () => {
    const result = parseDeadline({ date: "2026-11-01", time: "01:30" });

    expect(result).toEqual({
      ok: true,
      value: "2026-11-01T08:30:00.000Z",
    });
    expect(result).not.toEqual({
      ok: true,
      value: "2026-11-01T09:30:00.000Z",
    });
  });

  it("rejects a wall-clock time skipped by the spring clock change", () => {
    expect(
      parseDeadline({ date: "2027-03-14", time: "02:30" }),
    ).toEqual({
      ok: false,
      error:
        "That date and time doesn't exist because of the clock change. Pick another time.",
    });
  });

  it.each([
    ["2026-02-30", "12:00"],
    ["garbage", "12:00"],
    ["2026-10-09", "24:00"],
    ["2026-10-09", "12:60"],
    ["2026-10-09", ""],
  ])("rejects invalid input %s %s without NaN", (date, time) => {
    const result = parseDeadline({ date, time });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("NaN");
  });
});

describe("validateAssignmentInput", () => {
  it("accepts and normalizes a fully valid object", () => {
    expect(validate()).toEqual({
      ok: true,
      value: {
        classId: TEST_CLASS_ID,
        title: "Test Assignment A",
        deadlineIso: "2026-10-10T06:59:00.000Z",
        weight: "medium",
        specText: "Made-up assignment details.",
      },
    });
  });

  it.each([
    ["classId", { classId: "" }, "Choose a class."],
    ["classId", { classId: "not-a-uuid" }, "Choose a class."],
    ["title", { title: "" }, "Enter a title."],
    ["title", { title: "   " }, "Enter a title."],
    ["deadlineDate", { deadlineDate: "" }, "Enter a due date."],
    ["deadlineDate", { deadlineDate: "2026-02-30" }, "Enter a due date."],
    ["deadlineTime", { deadlineTime: "" }, "Enter a due time."],
    ["deadlineTime", { deadlineTime: "24:00" }, "Enter a due time."],
    ["weight", { weight: "" }, "Choose a weight."],
    ["weight", { weight: "urgent" }, "Choose a weight."],
  ] as const)("uses the required message for %s", (field, overrides, message) => {
    expectFieldError(field, message, overrides);
  });

  it("accepts a title of exactly 120 characters", () => {
    const result = validate({ title: "T".repeat(120) });

    expect(result.ok).toBe(true);
  });

  it("rejects a title of 121 characters", () => {
    expectFieldError(
      "title",
      "Title must be 120 characters or fewer.",
      { title: "T".repeat(121) },
    );
  });

  it("counts title length after trimming", () => {
    const result = validate({ title: `  ${"T".repeat(120)}  ` });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toHaveLength(120);
    }
  });

  it("accepts spec text of exactly 100,000 characters", () => {
    expect(validate({ specText: "S".repeat(100_000) }).ok).toBe(true);
  });

  it("rejects spec text of 100,001 characters", () => {
    expectFieldError(
      "specText",
      "Spec text must be 100,000 characters or fewer.",
      { specText: "S".repeat(100_001) },
    );
  });

  it("turns blank spec text into null", () => {
    const result = validate({ specText: "   " });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.specText).toBeNull();
    }
  });

  it("rejects a past deadline when creating", () => {
    const result = validate(
      { deadlineTime: "23:58" },
      { mode: "create", now: new Date("2026-10-10T06:59:00.000Z") },
    );

    expect(result).toEqual({
      ok: false,
      errors: { deadlineTime: "Deadline must be in the future." },
    });
  });

  it("rejects a deadline exactly equal to now when creating", () => {
    const result = validate(
      {},
      { mode: "create", now: new Date("2026-10-10T06:59:00.000Z") },
    );

    expect(result).toEqual({
      ok: false,
      errors: { deadlineTime: "Deadline must be in the future." },
    });
  });

  it("accepts a future deadline when creating", () => {
    expect(
      validate(
        {},
        { mode: "create", now: new Date("2026-10-10T06:58:00.000Z") },
      ).ok,
    ).toBe(true);
  });

  it("keeps an unchanged past deadline exactly when editing", () => {
    const currentDeadlineIso = "2026-10-10T06:59:00.000Z";
    const result = validate({}, {
      mode: "edit",
      now: new Date("2026-10-11T00:00:00.000Z"),
      currentDeadlineIso,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deadlineIso).toBe(currentDeadlineIso);
    }
  });

  it("rejects changing an edit deadline to a new past time", () => {
    const result = validate(
      { deadlineTime: "23:58" },
      {
        mode: "edit",
        now: new Date("2026-10-11T00:00:00.000Z"),
        currentDeadlineIso: "2026-10-10T06:59:00.000Z",
      },
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        deadlineTime: "A changed deadline must be in the future.",
      },
    });
  });

  it("accepts changing an edit deadline to a future time", () => {
    const result = validate(
      { deadlineDate: "2026-10-12" },
      {
        mode: "edit",
        now: new Date("2026-10-11T00:00:00.000Z"),
        currentDeadlineIso: "2026-10-10T06:59:00.000Z",
      },
    );

    expect(result.ok).toBe(true);
  });

  it("preserves the later stored instant for an unchanged ambiguous time", () => {
    const currentDeadlineIso = "2026-11-01T09:30:00.000Z";
    const result = validate(
      { deadlineDate: "2026-11-01", deadlineTime: "01:30" },
      {
        mode: "edit",
        now: new Date("2026-11-02T00:00:00.000Z"),
        currentDeadlineIso,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deadlineIso).toBe(currentDeadlineIso);
    }
  });

  it("treats a missing current edit deadline as changed", () => {
    const result = validate({}, {
      mode: "edit",
      now: new Date("2026-10-11T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        deadlineTime: "A changed deadline must be in the future.",
      },
    });
  });

  it("never returns technical default validation wording", () => {
    const results = [
      validate({ classId: "", title: "", deadlineDate: "", deadlineTime: "" }),
      validate({ specText: "S".repeat(100_001) }),
      validate(
        { deadlineDate: "2027-03-14", deadlineTime: "02:30" },
        { mode: "create", now: new Date("2027-03-01T00:00:00.000Z") },
      ),
    ];
    const messages = JSON.stringify(results);

    expect(messages).not.toMatch(/NaN|expected|received/i);
  });
});

describe("deadline display helpers", () => {
  it("exports the default due time", () => {
    expect(DEFAULT_DEADLINE_TIME).toBe("23:59");
  });

  it.each([
    ["2026-10-10T06:59:00.000Z", { date: "2026-10-09", time: "23:59" }],
    ["2026-11-03T07:59:00.000Z", { date: "2026-11-02", time: "23:59" }],
    ["2026-11-01T20:00:00.000Z", { date: "2026-11-01", time: "12:00" }],
  ])("round trips %s through form values", (iso, expected) => {
    const formValues = deadlineToFormValues(iso);

    expect(formValues).toEqual(expected);
    expect(parseDeadline(formValues)).toEqual({ ok: true, value: iso });
  });

  it("converts the later ambiguous instant to the shared wall-clock form time", () => {
    expect(deadlineToFormValues("2026-11-01T09:30:00.000Z")).toEqual({
      date: "2026-11-01",
      time: "01:30",
    });
  });

  it("formats a deadline in the current Los Angeles year without a year", () => {
    expect(
      formatDeadline(
        "2026-10-10T06:59:00.000Z",
        new Date("2026-01-15T12:00:00.000Z"),
      ),
    ).toBe("Fri, Oct 9, 11:59 PM");
  });

  it("adds the year when it differs from the current Los Angeles year", () => {
    expect(
      formatDeadline(
        "2027-10-10T06:59:00.000Z",
        new Date("2026-01-15T12:00:00.000Z"),
      ),
    ).toBe("Sat, Oct 9, 2027, 11:59 PM");
  });
});

describe("formatEstimate", () => {
  it.each([
    [null, "Not broken down yet"],
    [undefined, "Not broken down yet"],
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
  ])("formats %s as %s", (minutes, expected) => {
    expect(formatEstimate(minutes)).toBe(expected);
  });
});

describe("splitAssignments", () => {
  it("groups statuses, sorts deadlines, and breaks ties by title", () => {
    const result = splitAssignments([
      {
        id: "active-b",
        title: "Test Assignment B",
        deadline: "2026-10-12T00:00:00.000Z",
        status: "active" as const,
      },
      {
        id: "done",
        title: "Test Assignment Done",
        deadline: "2026-10-11T00:00:00.000Z",
        status: "done" as const,
      },
      {
        id: "active-a",
        title: "Test Assignment A",
        deadline: "2026-10-12T00:00:00.000Z",
        status: "active" as const,
      },
      {
        id: "active-early",
        title: "Test Assignment Early",
        deadline: "2026-10-10T00:00:00.000Z",
        status: "active" as const,
      },
      {
        id: "dropped",
        title: "Test Assignment Dropped",
        deadline: "2026-10-09T00:00:00.000Z",
        status: "dropped" as const,
      },
    ]);

    expect(result.active.map((assignment) => assignment.id)).toEqual([
      "active-early",
      "active-a",
      "active-b",
    ]);
    expect(result.done.map((assignment) => assignment.id)).toEqual(["done"]);
    expect(result.dropped.map((assignment) => assignment.id)).toEqual([
      "dropped",
    ]);
  });

  it("returns empty groups for an empty list", () => {
    expect(splitAssignments([])).toEqual({ active: [], done: [], dropped: [] });
  });
});
