import { describe, expect, it } from "vitest";

import type { FixedEventValue } from "./event-mapper";
import {
  planSync,
  type ExistingFixedEvent,
} from "./sync-planner";

const CALENDAR_A = "calendar-a@example.com";
const CALENDAR_B = "calendar-b@example.com";

function incoming(
  overrides: Partial<FixedEventValue> = {},
): FixedEventValue {
  return {
    source_calendar_id: CALENDAR_A,
    google_event_id: "event@example.com",
    title: "Test Class A",
    start: "2026-10-26T17:00:00.000Z",
    end: "2026-10-26T18:00:00.000Z",
    ...overrides,
  };
}

function existing(
  overrides: Partial<ExistingFixedEvent> = {},
): ExistingFixedEvent {
  return {
    id: "row-a",
    ...incoming(),
    ...overrides,
  };
}

describe("planSync", () => {
  it("inserts a new event", () => {
    const event = incoming();

    expect(
      planSync({
        existing: [],
        incoming: [event],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({ inserts: [event], updates: [], deletes: [] });
  });

  it("does nothing for an unchanged event", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [incoming()],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({ inserts: [], updates: [], deletes: [] });
  });

  it("updates a changed title", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [incoming({ title: "Test Class B" })],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({
      inserts: [],
      updates: [{ id: "row-a", title: "Test Class B" }],
      deletes: [],
    });
  });

  it("updates a changed start instant", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [incoming({ start: "2026-10-26T17:30:00.000Z" })],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({
      inserts: [],
      updates: [{ id: "row-a", start: "2026-10-26T17:30:00.000Z" }],
      deletes: [],
    });
  });

  it("deletes an event missing from the incoming list", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({ inserts: [], updates: [], deletes: ["row-a"] });
  });

  it("deletes an event from a deselected calendar", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [incoming()],
        selectedCalendarIds: [],
      }),
    ).toEqual({ inserts: [], updates: [], deletes: ["row-a"] });
  });

  it("keeps identical Google event ids separate across calendars", () => {
    const calendarAEvent = incoming();
    const calendarBEvent = incoming({ source_calendar_id: CALENDAR_B });

    expect(
      planSync({
        existing: [existing()],
        incoming: [calendarAEvent, calendarBEvent],
        selectedCalendarIds: [CALENDAR_A, CALENDAR_B],
      }),
    ).toEqual({
      inserts: [calendarBEvent],
      updates: [],
      deletes: [],
    });
  });

  it("treats differently formatted equal instants as unchanged", () => {
    expect(
      planSync({
        existing: [existing()],
        incoming: [
          incoming({
            start: "2026-10-26T10:00:00-07:00",
            end: "2026-10-26T11:00:00-07:00",
          }),
        ],
        selectedCalendarIds: [CALENDAR_A],
      }),
    ).toEqual({ inserts: [], updates: [], deletes: [] });
  });

  it("returns an empty plan for empty inputs", () => {
    expect(
      planSync({
        existing: [],
        incoming: [],
        selectedCalendarIds: [],
      }),
    ).toEqual({ inserts: [], updates: [], deletes: [] });
  });
});
