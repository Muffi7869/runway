import { describe, expect, it } from "vitest";

import type { CanvasFeedItem } from "./parse";
import { planImport } from "./plan";

const now = new Date("2026-10-01T19:00:00.000Z");

function dateItem(
  uid: string,
  date: string,
  bracketText = "CSE012_FA26_123456",
): CanvasFeedItem {
  return {
    uid,
    title: `Test ${uid}`,
    bracketText,
    due: { kind: "date", date },
  };
}

function timedItem(uid: string, iso: string): CanvasFeedItem {
  return {
    uid,
    title: `Test ${uid}`,
    bracketText: "",
    due: { kind: "datetime", iso },
  };
}

describe("planImport", () => {
  it("plans fresh, changed, already, status-protected, and out-of-window items", () => {
    const items = [
      dateItem("event-assignment-1", "2026-10-05"),
      dateItem("event-assignment-2", "2026-10-06"),
      dateItem("event-assignment-3", "2026-10-07"),
      timedItem("event-assignment-4", "2026-10-08T18:00:00.000Z"),
      timedItem("event-assignment-5", "2026-10-09T18:00:00.000Z"),
      dateItem("event-assignment-6", "2026-10-10"),
      dateItem("event-assignment-7", "2026-10-11"),
      dateItem("event-assignment-8", "2027-01-01"),
    ];
    const existing = [
      {
        id: "stored-2",
        canvas_uid: "event-assignment-2",
        deadline: "2026-10-06T01:00:00.000Z",
        status: "active" as const,
        title: "Stored A",
      },
      {
        id: "stored-3",
        canvas_uid: "event-assignment-3",
        deadline: "2026-10-07T15:00:00.000Z",
        status: "active" as const,
        title: "Stored B",
      },
      {
        id: "stored-4",
        canvas_uid: "event-assignment-4",
        deadline: "2026-10-08T17:00:00.000Z",
        status: "active" as const,
        title: "Stored C",
      },
      {
        id: "stored-5",
        canvas_uid: "event-assignment-5",
        deadline: "2026-10-09T18:00:00.000Z",
        status: "active" as const,
        title: "Stored D",
      },
      {
        id: "stored-6",
        canvas_uid: "event-assignment-6",
        deadline: "2026-10-02T19:00:00.000Z",
        status: "done" as const,
        title: "Stored E",
      },
      {
        id: "stored-7",
        canvas_uid: "event-assignment-7",
        deadline: "2026-10-03T19:00:00.000Z",
        status: "dropped" as const,
        title: "Stored F",
      },
      {
        id: "not-in-feed",
        canvas_uid: "event-assignment-999",
        deadline: "2026-10-04T19:00:00.000Z",
        status: "active" as const,
        title: "Stored Missing",
      },
    ];

    const result = planImport(
      items,
      existing,
      [{ id: "class-cse", name: "CSE 12" }],
      now,
    );

    expect(result.outsideWindow).toBe(1);
    expect(result.fresh).toHaveLength(1);
    expect(result.fresh[0]).toMatchObject({
      uid: "event-assignment-1",
      match: { status: "one", classId: "class-cse" },
      defaultDueIso: "2026-10-06T06:59:00.000Z",
    });
    expect(result.changed.map((item) => item.uid)).toEqual([
      "event-assignment-2",
      "event-assignment-4",
    ]);
    expect(result.already.map((item) => [item.uid, item.status])).toEqual([
      ["event-assignment-3", "active"],
      ["event-assignment-5", "active"],
      ["event-assignment-6", "done"],
      ["event-assignment-7", "dropped"],
    ]);
    expect(result.already.some((item) => item.id === "not-in-feed")).toBe(false);
    expect(result.changed.some((item) => item.uid === "event-assignment-6")).toBe(false);
    expect(result.changed.some((item) => item.uid === "event-assignment-7")).toBe(false);
  });
});
