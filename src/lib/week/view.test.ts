import { describe, expect, it } from "vitest";

import type { CalendarDate } from "../time/zoned";

import {
  assignLanes,
  formatLastSynced,
  formatTimeRange,
  hourRange,
  parseWeekParam,
  segmentEventsByDay,
  type WeekEventSegment,
  weekBounds,
  weekDays,
} from "./view";

const OCTOBER_WEEK: CalendarDate = { year: 2026, month: 10, day: 26 };
const NOVEMBER_WEEK: CalendarDate = { year: 2026, month: 11, day: 2 };
const NOW = new Date("2026-11-04T20:00:00.000Z");

function segment(
  id: string,
  startMinute: number,
  endMinute: number,
  dayIndex = 0,
): WeekEventSegment {
  return {
    id,
    title: `Test Event ${id}`,
    dayIndex,
    startMinute,
    endMinute,
  };
}

describe("parseWeekParam", () => {
  it("normalizes a Wednesday to its Monday", () => {
    expect(parseWeekParam("2026-10-28", NOW)).toEqual(OCTOBER_WEEK);
  });

  it("normalizes a Sunday to its Monday", () => {
    expect(parseWeekParam("2026-11-01", NOW)).toEqual(OCTOBER_WEEK);
  });

  it("falls back to the current week for an invalid real date", () => {
    expect(parseWeekParam("2026-02-30", NOW)).toEqual(NOVEMBER_WEEK);
  });

  it("falls back to the current week when the value is missing", () => {
    expect(parseWeekParam(undefined, NOW)).toEqual(NOVEMBER_WEEK);
  });
});

describe("week dates and bounds", () => {
  it("lists the seven days across the week containing the DST change", () => {
    expect(weekDays(OCTOBER_WEEK)).toEqual([
      { year: 2026, month: 10, day: 26 },
      { year: 2026, month: 10, day: 27 },
      { year: 2026, month: 10, day: 28 },
      { year: 2026, month: 10, day: 29 },
      { year: 2026, month: 10, day: 30 },
      { year: 2026, month: 10, day: 31 },
      { year: 2026, month: 11, day: 1 },
    ]);
  });

  it("lists the seven days in the following week", () => {
    expect(weekDays(NOVEMBER_WEEK)).toEqual([
      { year: 2026, month: 11, day: 2 },
      { year: 2026, month: 11, day: 3 },
      { year: 2026, month: 11, day: 4 },
      { year: 2026, month: 11, day: 5 },
      { year: 2026, month: 11, day: 6 },
      { year: 2026, month: 11, day: 7 },
      { year: 2026, month: 11, day: 8 },
    ]);
  });

  it("makes the week containing the fall-back transition 169 hours long", () => {
    const bounds = weekBounds(OCTOBER_WEEK);

    expect(bounds.start.toISOString()).toBe("2026-10-26T07:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect((bounds.end.getTime() - bounds.start.getTime()) / 3_600_000).toBe(
      169,
    );
  });
});

describe("segmentEventsByDay", () => {
  it.each([
    [
      "before the DST change",
      OCTOBER_WEEK,
      "2026-10-26T17:00:00.000Z",
      "2026-10-26T18:00:00.000Z",
    ],
    [
      "after the DST change",
      NOVEMBER_WEEK,
      "2026-11-02T18:00:00.000Z",
      "2026-11-02T19:00:00.000Z",
    ],
  ])("places a 10 AM Monday class at minute 600 %s", (_name, monday, start, end) => {
    const segments = segmentEventsByDay(
      [{ id: "class", title: "Test Class A", start, end }],
      monday,
    );

    expect(segments).toMatchObject([
      { id: "class", dayIndex: 0, startMinute: 600, endMinute: 660 },
    ]);
  });

  it("places a 10 AM event on fall-back Sunday at minute 600", () => {
    const segments = segmentEventsByDay(
      [
        {
          id: "sunday-event",
          title: "Test Event A",
          start: "2026-11-01T18:00:00.000Z",
          end: "2026-11-01T19:00:00.000Z",
        },
      ],
      OCTOBER_WEEK,
    );

    expect(segments[0]).toMatchObject({
      dayIndex: 6,
      startMinute: 600,
      endMinute: 660,
    });
  });

  it("splits an event crossing midnight into two day segments", () => {
    const segments = segmentEventsByDay(
      [
        {
          id: "overnight",
          title: "Test Event B",
          start: "2026-10-27T06:30:00.000Z",
          end: "2026-10-27T07:30:00.000Z",
        },
      ],
      OCTOBER_WEEK,
    );

    expect(segments).toEqual([
      {
        id: "overnight",
        title: "Test Event B",
        dayIndex: 0,
        startMinute: 1410,
        endMinute: 1440,
      },
      {
        id: "overnight",
        title: "Test Event B",
        dayIndex: 1,
        startMinute: 0,
        endMinute: 30,
      },
    ]);
  });

  it("drops an event outside the week", () => {
    expect(
      segmentEventsByDay(
        [
          {
            id: "outside",
            title: "Test Event C",
            start: "2026-10-20T17:00:00.000Z",
            end: "2026-10-20T18:00:00.000Z",
          },
        ],
        OCTOBER_WEEK,
      ),
    ).toEqual([]);
  });

  it("clips events that overlap the week edges", () => {
    const segments = segmentEventsByDay(
      [
        {
          id: "week-edge",
          title: "Test Event D",
          start: "2026-10-26T06:30:00.000Z",
          end: "2026-10-26T07:30:00.000Z",
        },
      ],
      OCTOBER_WEEK,
    );

    expect(segments).toMatchObject([
      { dayIndex: 0, startMinute: 0, endMinute: 30 },
    ]);
  });
});

describe("assignLanes", () => {
  it("gives overlapping events two lanes and a separate event one lane", () => {
    const layouts = assignLanes([
      segment("a", 540, 600),
      segment("b", 570, 630),
      segment("c", 660, 720),
    ]);

    expect(layouts.map(({ id, lane, laneCount }) => ({ id, lane, laneCount })))
      .toEqual([
        { id: "a", lane: 0, laneCount: 2 },
        { id: "b", lane: 1, laneCount: 2 },
        { id: "c", lane: 0, laneCount: 1 },
      ]);
  });
});

describe("hourRange", () => {
  it("uses the study window when there are no events", () => {
    expect(
      hourRange({
        segments: [],
        studyWindowStartMinutes: 510,
        studyWindowEndMinutes: 1035,
      }),
    ).toEqual({ startHour: 8, endHour: 18 });
  });

  it("expands earlier than the study window", () => {
    expect(
      hourRange({
        segments: [segment("early", 405, 450)],
        studyWindowStartMinutes: 510,
        studyWindowEndMinutes: 1035,
      }),
    ).toEqual({ startHour: 6, endHour: 18 });
  });

  it("expands later than the study window and clamps at midnight", () => {
    expect(
      hourRange({
        segments: [segment("late", 1330, 1400)],
        studyWindowStartMinutes: 510,
        studyWindowEndMinutes: 1035,
      }),
    ).toEqual({ startHour: 8, endHour: 24 });
  });
});

describe("formatLastSynced", () => {
  it.each([
    [null, "Never synced"],
    ["2026-11-04T19:59:30.000Z", "just now"],
    ["2026-11-04T19:59:00.000Z", "1 minute ago"],
    ["2026-11-04T19:55:00.000Z", "5 minutes ago"],
    ["2026-11-04T19:00:00.000Z", "1 hour ago"],
    ["2026-11-04T17:00:00.000Z", "3 hours ago"],
    ["2026-11-03T20:00:00.000Z", "1 day ago"],
    ["2026-10-31T20:00:00.000Z", "4 days ago"],
  ])("formats %s as %s", (lastSyncedAt, expected) => {
    expect(formatLastSynced(lastSyncedAt, NOW)).toBe(expected);
  });
});

describe("formatTimeRange", () => {
  it("formats both instants in Los Angeles time", () => {
    expect(
      formatTimeRange(
        "2026-10-26T17:00:00.000Z",
        "2026-10-26T18:15:00.000Z",
      ),
    ).toBe("10:00 AM – 11:15 AM");
  });
});
