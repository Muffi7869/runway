import { describe, expect, it } from "vitest";

import { eventPlacement } from "./placement";

const BASE_INPUT = {
  startHour: 8,
  rowHeightPx: 64,
  minHeightPx: 20,
};

describe("eventPlacement", () => {
  it("places an 8:00 to 8:50 event on the 8 AM line", () => {
    const placement = eventPlacement({
      ...BASE_INPUT,
      startMinute: 8 * 60,
      endMinute: 8 * 60 + 50,
    });

    expect(placement.topPx).toBe(0);
    expect(placement.heightPx).toBeCloseTo(53.33, 2);
  });

  it("places a 9:00 to 9:50 event one row below 8 AM", () => {
    expect(
      eventPlacement({
        ...BASE_INPUT,
        startMinute: 9 * 60,
        endMinute: 9 * 60 + 50,
      }),
    ).toMatchObject({ topPx: 64 });
  });

  it("uses the minimum height for a short event", () => {
    expect(
      eventPlacement({
        ...BASE_INPUT,
        startMinute: 10 * 60,
        endMinute: 10 * 60 + 10,
      }),
    ).toEqual({ topPx: 128, heightPx: 20 });
  });

  it("clamps an event before the visible start to the top", () => {
    expect(
      eventPlacement({
        ...BASE_INPUT,
        startMinute: 7 * 60 + 30,
        endMinute: 8 * 60 + 15,
      }).topPx,
    ).toBe(0);
  });

  it.each([
    [8, 0],
    [9, 64],
    [10, 128],
    [16, 512],
  ])("places an event at %i:00 at top %i", (hour, topPx) => {
    expect(
      eventPlacement({
        ...BASE_INPUT,
        startMinute: hour * 60,
        endMinute: hour * 60 + 50,
      }).topPx,
    ).toBe(topPx);
  });
});
