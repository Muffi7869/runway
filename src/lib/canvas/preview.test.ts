import { describe, expect, it } from "vitest";

import type { ImportPlan } from "./plan";
import { freshRowAvailability, toCanvasPreview } from "./preview";

const now = new Date("2026-10-12T19:00:00.000Z");

describe("toCanvasPreview", () => {
  it("shapes fresh, changed, already, and skipped rows for the browser", () => {
    const plan: ImportPlan = {
      fresh: [
        {
          uid: "event-assignment-1",
          title: "Test Assignment A",
          bracketText: "CSE012_FA26_123456",
          due: { kind: "date", date: "2026-10-20" },
          defaultDueIso: "2026-10-21T06:59:00.000Z",
          match: { status: "one", classId: "class-a" },
        },
      ],
      changed: [
        {
          id: "assignment-b",
          uid: "event-assignment-2",
          title: "Test Assignment B",
          oldDeadline: "2026-10-22T18:00:00.000Z",
          newDue: { kind: "datetime", iso: "2026-10-23T18:00:00.000Z" },
        },
      ],
      already: [
        {
          id: "assignment-c",
          uid: "event-assignment-3",
          title: "Test Assignment C",
          deadline: "2026-10-24T18:00:00.000Z",
          status: "done",
        },
      ],
      outsideWindow: 2,
    };

    const preview = toCanvasPreview(
      plan,
      { notAssignment: 3, unsupportedTime: 1, unreadable: 0 },
      [{ id: "class-a", name: "CSE 12" }],
      now,
    );

    expect(preview.fresh[0]).toEqual({
      uid: "event-assignment-1",
      title: "Test Assignment A",
      defaultTime: "23:59",
      dueLabel: "2026-10-20",
      isDateOnly: true,
      matchStatus: "one",
      preselectedClassId: "class-a",
    });
    expect(preview.changed[0]).toMatchObject({
      uid: "event-assignment-2",
      title: "Test Assignment B",
    });
    expect(preview.already[0]).toMatchObject({
      title: "Test Assignment C",
      status: "done",
    });
    expect(preview.skipped).toEqual({
      outsideWindow: 2,
      notAssignment: 3,
      unsupportedTime: 1,
      unreadable: 0,
    });
  });
});

describe("freshRowAvailability", () => {
  const row = { isDateOnly: true, dueLabel: "2026-10-20" };

  it("requires a class", () => {
    expect(freshRowAvailability(row, "", "23:59", now)).toEqual({
      importable: false,
      message: "Choose a class",
    });
  });

  it("accepts a chosen class and in-window date-only time", () => {
    expect(freshRowAvailability(row, "class-a", "23:59", now)).toEqual({
      importable: true,
    });
  });

  it("rejects a date-only time outside the import window", () => {
    expect(
      freshRowAvailability(
        { isDateOnly: true, dueLabel: "2027-01-01" },
        "class-a",
        "23:59",
        now,
      ),
    ).toEqual({
      importable: false,
      message: "Past or outside the import window",
    });
  });

  it("allows a timed row when its class is chosen", () => {
    expect(
      freshRowAvailability(
        { isDateOnly: false, dueLabel: "Oct 20" },
        "class-a",
        "00:00",
        now,
      ),
    ).toEqual({ importable: true });
  });
});
