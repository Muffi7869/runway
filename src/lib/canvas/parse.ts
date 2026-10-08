import ICAL from "ical.js";

export type CanvasDue =
  | { kind: "date"; date: string }
  | { kind: "datetime"; iso: string };

export type CanvasFeedItem = {
  uid: string;
  title: string;
  bracketText: string;
  due: CanvasDue;
};

export type CanvasSkippedCounts = {
  notAssignment: number;
  unsupportedTime: number;
  unreadable: number;
};

export type ParseCanvasFeedResult =
  | {
      ok: true;
      items: CanvasFeedItem[];
      skipped: CanvasSkippedCounts;
    }
  | { ok: false };

const ASSIGNMENT_UID_PREFIX = "event-assignment-";

function dateString(value: ICAL.Time): string | null {
  const text = value.toString();
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
}

function utcIso(value: ICAL.Time): string | null {
  if (value.zone?.tzid !== "UTC" && !value.toString().endsWith("Z")) {
    return null;
  }

  const instant = new Date(value.toUnixTime() * 1000);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
}

function titleAndBracket(summary: string): {
  title: string;
  bracketText: string;
} {
  const bracket = /\s*\[([^\[\]]*)\]\s*$/u.exec(summary);
  const rawTitle = bracket ? summary.slice(0, bracket.index).trim() : summary.trim();
  const title =
    rawTitle.length <= 120
      ? rawTitle
      : `${rawTitle.slice(0, 119).trimEnd()}…`;

  return {
    title,
    bracketText: bracket ? bracket[1].trim() : "",
  };
}

export function parseCanvasFeed(text: string): ParseCanvasFeedResult {
  let events: ICAL.Component[];

  try {
    const parsed = ICAL.parse(text);
    const calendar = new ICAL.Component(parsed);
    events = calendar.getAllSubcomponents("vevent");
  } catch {
    return { ok: false };
  }

  const items: CanvasFeedItem[] = [];
  const skipped: CanvasSkippedCounts = {
    notAssignment: 0,
    unsupportedTime: 0,
    unreadable: 0,
  };

  for (const event of events) {
    try {
      const uidValue = event.getFirstPropertyValue("uid");

      if (typeof uidValue !== "string" || !uidValue) {
        skipped.unreadable += 1;
        continue;
      }

      if (!uidValue.startsWith(ASSIGNMENT_UID_PREFIX)) {
        skipped.notAssignment += 1;
        continue;
      }

      const summaryValue = event.getFirstPropertyValue("summary");
      const { title, bracketText } = titleAndBracket(
        typeof summaryValue === "string" ? summaryValue : "",
      );

      if (!title) {
        skipped.unreadable += 1;
        continue;
      }

      const startProperty = event.getFirstProperty("dtstart");
      const start = startProperty?.getFirstValue();

      if (!startProperty || !(start instanceof ICAL.Time)) {
        skipped.unreadable += 1;
        continue;
      }

      let due: CanvasDue;

      if (start.isDate) {
        const date = dateString(start);

        if (!date) {
          skipped.unreadable += 1;
          continue;
        }

        due = { kind: "date", date };
      } else {
        if (startProperty.getFirstParameter("tzid")) {
          skipped.unsupportedTime += 1;
          continue;
        }

        const iso = utcIso(start);

        if (!iso) {
          skipped.unsupportedTime += 1;
          continue;
        }

        due = { kind: "datetime", iso };
      }

      items.push({ uid: uidValue, title, bracketText, due });
    } catch {
      skipped.unreadable += 1;
    }
  }

  return { ok: true, items, skipped };
}
