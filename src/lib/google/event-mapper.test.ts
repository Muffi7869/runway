import { describe, expect, it } from "vitest";

import { APP_TIMEZONE, zonedParts } from "../time/zoned";

import {
  mapGoogleEvent,
  type GoogleEventInput,
} from "./event-mapper";

const SOURCE_CALENDAR = "source-calendar@example.com";

function timedEvent(
  overrides: Partial<GoogleEventInput> = {},
): GoogleEventInput {
  return {
    id: "event@example.com",
    summary: "Test Class A",
    start: { dateTime: "2026-10-26T10:00:00-07:00" },
    end: { dateTime: "2026-10-26T11:00:00-07:00" },
    ...overrides,
  };
}

describe("mapGoogleEvent", () => {
  it("maps a normal timed event to UTC", () => {
    expect(mapGoogleEvent(timedEvent(), SOURCE_CALENDAR)).toEqual({
      kind: "event",
      value: {
        google_event_id: "event@example.com",
        source_calendar_id: SOURCE_CALENDAR,
        title: "Test Class A",
        start: "2026-10-26T17:00:00.000Z",
        end: "2026-10-26T18:00:00.000Z",
      },
    });
  });

  it("maps expanded recurring occurrences separately", () => {
    const first = mapGoogleEvent(
      timedEvent({ id: "instance-one@example.com" }),
      SOURCE_CALENDAR,
    );
    const second = mapGoogleEvent(
      timedEvent({
        id: "instance-two@example.com",
        start: { dateTime: "2026-11-02T10:00:00-08:00" },
        end: { dateTime: "2026-11-02T11:00:00-08:00" },
      }),
      SOURCE_CALENDAR,
    );

    expect(first.kind).toBe("event");
    expect(second.kind).toBe("event");

    if (first.kind === "event" && second.kind === "event") {
      expect(first.value.google_event_id).toBe("instance-one@example.com");
      expect(first.value.start).toBe("2026-10-26T17:00:00.000Z");
      expect(second.value.google_event_id).toBe("instance-two@example.com");
      expect(second.value.start).toBe("2026-11-02T18:00:00.000Z");
    }
  });

  it.each([
    [
      "all-day",
      timedEvent({
        id: "all-day@example.com",
        start: { date: "2026-10-26" },
        end: { date: "2026-10-27" },
      }),
      "all_day",
    ],
    [
      "declined",
      timedEvent({
        id: "declined@example.com",
        attendees: [{ self: true, responseStatus: "declined" }],
      }),
      "declined",
    ],
    [
      "free",
      timedEvent({
        id: "free@example.com",
        transparency: "transparent",
      }),
      "free",
    ],
    [
      "cancelled",
      timedEvent({ id: "cancelled@example.com", status: "cancelled" }),
      "cancelled",
    ],
    [
      "working location",
      timedEvent({
        id: "working-location@example.com",
        eventType: "workingLocation",
      }),
      "working_location",
    ],
  ] as const)("skips a %s event", (_name, event, reason) => {
    expect(mapGoogleEvent(event, SOURCE_CALENDAR)).toEqual({
      kind: "skip",
      reason,
    });
  });

  it.each(["outOfOffice", "focusTime"])(
    "keeps a %s event as fixed time",
    (eventType) => {
      const result = mapGoogleEvent(
        timedEvent({
          id: `${eventType}@example.com`,
          eventType,
          summary: `Test ${eventType}`,
        }),
        SOURCE_CALENDAR,
      );

      expect(result.kind).toBe("event");
    },
  );

  it("uses the event's explicit non-Los-Angeles offset", () => {
    const result = mapGoogleEvent(
      timedEvent({
        id: "new-york-offset@example.com",
        start: { dateTime: "2026-10-20T13:00:00-04:00" },
        end: { dateTime: "2026-10-20T14:00:00-04:00" },
      }),
      SOURCE_CALENDAR,
    );

    expect(result.kind).toBe("event");
    if (result.kind === "event") {
      expect(result.value.start).toBe("2026-10-20T17:00:00.000Z");
      expect(result.value.end).toBe("2026-10-20T18:00:00.000Z");
    }
  });

  it.each([
    [
      "unparseable text",
      timedEvent({
        id: "garbage@example.com",
        start: { dateTime: "garbage" },
      }),
    ],
    [
      "a datetime without an offset",
      timedEvent({
        id: "no-offset@example.com",
        start: { dateTime: "2026-10-26T10:00:00" },
      }),
    ],
    [
      "an end before its start",
      timedEvent({
        id: "backwards@example.com",
        start: { dateTime: "2026-10-26T11:00:00-07:00" },
        end: { dateTime: "2026-10-26T10:00:00-07:00" },
      }),
    ],
  ])("reports %s as unparseable", (_name, event) => {
    expect(mapGoogleEvent(event, SOURCE_CALENDAR)).toEqual({
      kind: "skip",
      reason: "unparseable",
    });
  });

  it("maps 10:00 Los Angeles time correctly across the DST change", () => {
    const before = mapGoogleEvent(
      timedEvent({
        id: "before-dst@example.com",
        start: { dateTime: "2026-10-26T10:00:00-07:00" },
        end: { dateTime: "2026-10-26T11:00:00-07:00" },
      }),
      SOURCE_CALENDAR,
    );
    const after = mapGoogleEvent(
      timedEvent({
        id: "after-dst@example.com",
        start: { dateTime: "2026-11-02T10:00:00-08:00" },
        end: { dateTime: "2026-11-02T11:00:00-08:00" },
      }),
      SOURCE_CALENDAR,
    );

    expect(before.kind).toBe("event");
    expect(after.kind).toBe("event");

    if (before.kind === "event" && after.kind === "event") {
      expect(before.value.start).toBe("2026-10-26T17:00:00.000Z");
      expect(after.value.start).toBe("2026-11-02T18:00:00.000Z");
      expect(zonedParts(new Date(before.value.start), APP_TIMEZONE).hour).toBe(
        10,
      );
      expect(zonedParts(new Date(after.value.start), APP_TIMEZONE).hour).toBe(
        10,
      );
    }
  });

  it("uses a safe title when the summary is missing", () => {
    const result = mapGoogleEvent(
      timedEvent({ id: "no-title@example.com", summary: undefined }),
      SOURCE_CALENDAR,
    );

    expect(result.kind).toBe("event");
    if (result.kind === "event") {
      expect(result.value.title).toBe("(No title)");
    }
  });
});
