import { describe, expect, it } from "vitest";

import {
  blockLabel,
  cleanEventTitle,
  isPastDay,
  limitLanes,
  mergeAdjacentBlocks,
  visibleHourRange,
  weekPlannedStat,
  type VisualBlock,
} from "./declutter";
import { segmentEventsByDay } from "./view";

const block = (overrides: Partial<VisualBlock> = {}): VisualBlock => ({
  id: "block-a",
  assignmentId: "assignment-a",
  className: "Test Class A",
  assignmentTitle: "Test Assignment A",
  stepName: "Draft",
  start: "2026-10-12T17:00:00.000Z",
  end: "2026-10-12T18:00:00.000Z",
  plannedMinutes: 60,
  status: "planned",
  ...overrides,
});

describe("Week declutter helpers", () => {
  it("uses and widens the study window, including on a DST week", () => {
    const settings = { studyWindowStartMinutes: 8 * 60, studyWindowEndMinutes: 22 * 60 };
    expect(visibleHourRange(settings, [])).toEqual({ startHour: 8, endHour: 22 });
    expect(visibleHourRange(settings, [{ startMinute: 430, endMinute: 1385 }])).toEqual({ startHour: 7, endHour: 24 });
    expect(visibleHourRange(settings, [{ startMinute: 600, endMinute: 660 }])).toEqual({ startHour: 8, endHour: 22 });
    expect(visibleHourRange(settings, [{ startMinute: 600, endMinute: 1500 }])).toEqual({ startHour: 8, endHour: 24 });
    const dstSegments = segmentEventsByDay(
      [{ id: "dst", title: "Test Event", start: "2026-11-01T18:00:00.000Z", end: "2026-11-01T19:00:00.000Z" }],
      { year: 2026, month: 10, day: 26 },
    );
    expect(dstSegments[0]?.startMinute).toBe(600);
    expect(visibleHourRange(settings, dstSegments)).toEqual({ startHour: 8, endHour: 22 });
  });

  it("merges only touching same-assignment blocks with the same status", () => {
    const adjacent = block({ id: "block-b", stepName: "Revise", start: "2026-10-12T18:00:00.000Z", end: "2026-10-12T18:30:00.000Z", plannedMinutes: 30 });
    const merged = mergeAdjacentBlocks([block(), adjacent]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ plannedMinutes: 90, stepNames: ["Draft", "Revise"], blockIds: ["block-a", "block-b"] });
    expect(mergeAdjacentBlocks([block(), adjacent, block({ id: "other", assignmentId: "assignment-b", start: adjacent.end, end: "2026-10-12T19:00:00.000Z" })])).toHaveLength(2);
    expect(mergeAdjacentBlocks([block(), { ...adjacent, start: "2026-10-12T18:05:00.000Z" }])).toHaveLength(2);
    expect(mergeAdjacentBlocks([block(), { ...adjacent, status: "checked_in" }])).toHaveLength(2);
  });

  it("adapts block labels at the 45 and 75 minute visual thresholds", () => {
    const merged = mergeAdjacentBlocks([block()])[0];
    expect(blockLabel(merged, 41)).toBe("Test Assignment A");
    expect(blockLabel(merged, 42)).toBe("Test Assignment A · Draft");
    expect(blockLabel(merged, 70)).toBe("Test Class A · Test Assignment A · Draft");
  });

  it("cleans balanced edge brackets without hiding malformed or empty titles", () => {
    expect(cleanEventTitle("[Test 101] Lecture")).toBe("Lecture");
    expect(cleanEventTitle("Lecture [Test 101]")).toBe("Lecture");
    expect(cleanEventTitle("[[Test 101]] Lecture")).toBe("Lecture");
    expect(cleanEventTitle("[Test 101 Lecture")).toBe("[Test 101 Lecture");
    expect(cleanEventTitle("[Test 101]")).toBe("[Test 101]");
    expect(cleanEventTitle("Lecture")).toBe("Lecture");
  });

  it("limits each overlap cluster to two lanes and reports hidden items", () => {
    const placed = [0, 1, 2].map((lane) => ({ id: `event-${lane}`, title: "Test", dayIndex: 0, startMinute: 600, endMinute: 660, lane, laneCount: 3 }));
    expect(limitLanes(placed)).toEqual({
      visible: [
        { ...placed[0], laneCount: 2 },
        { ...placed[1], laneCount: 2 },
      ],
      hidden: [{ dayIndex: 0, startMinute: 600, endMinute: 660, hiddenCount: 1 }],
    });
  });

  it("compares past days in Los Angeles across fall-back DST", () => {
    const now = new Date("2026-11-02T08:30:00.000Z");
    expect(isPastDay({ year: 2026, month: 11, day: 1 }, now)).toBe(true);
    expect(isPastDay({ year: 2026, month: 11, day: 2 }, now)).toBe(false);
  });

  it("formats the one-line planned total", () => {
    expect(weekPlannedStat(200)).toBe("3h 20m planned");
  });
});
