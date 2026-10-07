import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  WEEK_GRID_ROW_HEIGHT_PX,
  WeekGridPresentation,
  type WeekGridDay,
  type WeekGridEvent,
} from "./week-grid";

const days: WeekGridDay[] = [
  "Monday, Oct 5",
  "Tuesday, Oct 6",
  "Wednesday, Oct 7",
  "Thursday, Oct 8",
  "Friday, Oct 9",
  "Saturday, Oct 10",
  "Sunday, Oct 11",
].map((longLabel, index) => ({
  longLabel,
  shortLabel: longLabel.slice(0, 3),
  isToday: index === 2,
}));

function event(
  id: string,
  startHour: number,
  lane = 0,
  laneCount = 1,
): WeekGridEvent {
  return {
    id,
    title: `Test Event ${id}`,
    timeRange: `${startHour}:00 – ${startHour}:50`,
    dayIndex: 0,
    startMinute: startHour * 60,
    endMinute: startHour * 60 + 50,
    lane,
    laneCount,
  };
}

const events: WeekGridEvent[] = [
  event("event-8", 8, 0, 2),
  {
    ...event("event-overlap", 8, 1, 2),
    startMinute: 8 * 60 + 20,
    endMinute: 9 * 60,
  },
  event("event-9", 9),
  event("event-10", 10),
  event("event-16", 16),
];

function renderGrid(): string {
  return renderToStaticMarkup(
    <WeekGridPresentation
      activeDayIndex={0}
      days={days}
      endHour={18}
      events={events}
      startHour={8}
    />,
  );
}

function eventOpeningTag(markup: string, id: string): string {
  const match = markup.match(
    new RegExp(`<div[^>]*data-event-id="${id}"[^>]*>`),
  );

  if (!match) {
    throw new Error(`Missing event markup for ${id}.`);
  }

  return match[0];
}

describe("WeekGridPresentation", () => {
  it("renders seven day columns", () => {
    const markup = renderGrid();

    expect(markup.match(/data-day-column="\d"/g)).toHaveLength(7);
  });

  it("keeps Monday hour lines and event blocks in the same day container", () => {
    const markup = renderGrid();
    const mondayStart = markup.indexOf('data-day-column="0"');
    const tuesdayStart = markup.indexOf('data-day-column="1"');
    const mondayMarkup = markup.slice(mondayStart, tuesdayStart);

    expect(mondayMarkup).toContain('data-hour-line="8"');
    expect(mondayMarkup).toContain('data-hour-line="9"');
    expect(mondayMarkup).toContain('data-event-id="event-8"');
    expect(mondayMarkup).toContain('data-event-id="event-16"');
  });

  it.each([
    ["event-8", 0],
    ["event-9", 64],
    ["event-10", 128],
    ["event-16", 512],
  ])("renders %s at top %i", (id, topPx) => {
    const tag = eventOpeningTag(renderGrid(), id);
    const expectedTop =
      topPx === 0
        ? /top:0(?:px)?(?:;|")/
        : new RegExp(`top:${topPx}px`);

    expect(tag).toMatch(expectedTop);
  });

  it("gives overlapping events different horizontal positions", () => {
    const markup = renderGrid();

    expect(eventOpeningTag(markup, "event-8")).toContain("left:0%");
    expect(eventOpeningTag(markup, "event-overlap")).toContain("left:50%");
  });

  it("leaves a weekend day empty", () => {
    const markup = renderGrid();
    const saturdayStart = markup.indexOf('data-day-column="5"');
    const sundayStart = markup.indexOf('data-day-column="6"');
    const saturdayMarkup = markup.slice(saturdayStart, sundayStart);

    expect(saturdayMarkup).toContain('data-hour-line="8"');
    expect(saturdayMarkup).not.toContain("data-event-id");
  });

  it("uses the exported 64-pixel row height", () => {
    expect(WEEK_GRID_ROW_HEIGHT_PX).toBe(64);
  });
});
