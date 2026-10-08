import { describe, expect, it } from "vitest";

import { parseCanvasFeed } from "./parse";

function calendar(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Runway Test//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function event(...lines: string[]): string {
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
}

describe("parseCanvasFeed", () => {
  it("parses assignment dates and UTC times while removing the trailing bracket", () => {
    const result = parseCanvasFeed(
      calendar(
        event(
          "UID:event-assignment-1",
          "SUMMARY:Test Assignment A [CSE012_FA26_123456]",
          "DTSTART;VALUE=DATE:20261020",
        ),
        event(
          "UID:event-assignment-2",
          "SUMMARY:Test Assignment B [MATH180A_FA26_999999]",
          "DTSTART:20261021T190000Z",
        ),
        event(
          "UID:event-assignment-3",
          "SUMMARY:Test Assignment C",
          "DTSTART;VALUE=DATE:20261022",
        ),
      ),
    );

    expect(result).toEqual({
      ok: true,
      items: [
        {
          uid: "event-assignment-1",
          title: "Test Assignment A",
          bracketText: "CSE012_FA26_123456",
          due: { kind: "date", date: "2026-10-20" },
        },
        {
          uid: "event-assignment-2",
          title: "Test Assignment B",
          bracketText: "MATH180A_FA26_999999",
          due: { kind: "datetime", iso: "2026-10-21T19:00:00.000Z" },
        },
        {
          uid: "event-assignment-3",
          title: "Test Assignment C",
          bracketText: "",
          due: { kind: "date", date: "2026-10-22" },
        },
      ],
      skipped: { notAssignment: 0, unsupportedTime: 0, unreadable: 0 },
    });
  });

  it("counts every unsupported or unreadable item separately", () => {
    const result = parseCanvasFeed(
      calendar(
        event(
          "UID:event-calendar-1",
          "SUMMARY:Test Calendar Event",
          "DTSTART;VALUE=DATE:20261020",
        ),
        event(
          "UID:event-assignment-2",
          "SUMMARY:Test TZID Assignment",
          "DTSTART;TZID=America/Los_Angeles:20261020T120000",
        ),
        event(
          "UID:event-assignment-3",
          "SUMMARY:Test Floating Assignment",
          "DTSTART:20261020T120000",
        ),
        event(
          "UID:event-assignment-4",
          "SUMMARY:[CSE012_FA26_123456]",
          "DTSTART;VALUE=DATE:20261020",
        ),
        event("UID:event-assignment-5", "SUMMARY:Test Missing Date"),
        event("SUMMARY:Test Missing UID", "DTSTART;VALUE=DATE:20261020"),
      ),
    );

    expect(result).toEqual({
      ok: true,
      items: [],
      skipped: { notAssignment: 1, unsupportedTime: 2, unreadable: 3 },
    });
  });

  it("counts each skipped category independently", () => {
    const notAssignment = parseCanvasFeed(
      calendar(
        event(
          "UID:event-calendar-1",
          "SUMMARY:Test Event",
          "DTSTART;VALUE=DATE:20261020",
        ),
      ),
    );
    const unsupported = parseCanvasFeed(
      calendar(
        event(
          "UID:event-assignment-1",
          "SUMMARY:Test Assignment",
          "DTSTART:20261020T120000",
        ),
      ),
    );
    const unreadable = parseCanvasFeed(
      calendar(event("UID:event-assignment-1", "SUMMARY:Test Assignment")),
    );

    expect(notAssignment).toMatchObject({ skipped: { notAssignment: 1 } });
    expect(unsupported).toMatchObject({ skipped: { unsupportedTime: 1 } });
    expect(unreadable).toMatchObject({ skipped: { unreadable: 1 } });
  });

  it("shortens an overlong title and leaves exactly 120 characters alone", () => {
    const longTitle = "A".repeat(121);
    const exactTitle = "B".repeat(120);
    const result = parseCanvasFeed(
      calendar(
        event(
          "UID:event-assignment-1",
          `SUMMARY:${longTitle}`,
          "DTSTART;VALUE=DATE:20261020",
        ),
        event(
          "UID:event-assignment-2",
          `SUMMARY:${exactTitle}`,
          "DTSTART;VALUE=DATE:20261021",
        ),
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected the feed to parse.");
    expect(result.items[0].title).toBe(`${"A".repeat(119)}…`);
    expect(result.items[0].title).toHaveLength(120);
    expect(result.items[1].title).toBe(exactTitle);
  });

  it("returns not ok for invalid iCal text", () => {
    expect(parseCanvasFeed("not an iCalendar document")).toEqual({ ok: false });
  });
});
