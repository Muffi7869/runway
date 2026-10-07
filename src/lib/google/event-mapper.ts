export type GoogleEventInput = {
  id: string;
  status?: string;
  summary?: string;
  eventType?: string;
  transparency?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    self?: boolean;
    responseStatus?: string;
  }>;
};

export type FixedEventValue = {
  google_event_id: string;
  source_calendar_id: string;
  title: string;
  start: string;
  end: string;
};

export type GoogleEventMapping =
  | { kind: "event"; value: FixedEventValue }
  | {
      kind: "skip";
      reason:
        | "cancelled"
        | "working_location"
        | "all_day"
        | "declined"
        | "free"
        | "unparseable";
    };

const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/;

function parseExplicitDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!EXPLICIT_OFFSET.test(normalized)) {
    return null;
  }

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function mapGoogleEvent(
  event: GoogleEventInput,
  calendarId: string,
): GoogleEventMapping {
  if (event.status === "cancelled") {
    return { kind: "skip", reason: "cancelled" };
  }

  if (event.eventType === "workingLocation") {
    return { kind: "skip", reason: "working_location" };
  }

  if (event.start?.date && !event.start.dateTime) {
    return { kind: "skip", reason: "all_day" };
  }

  if (
    event.attendees?.some(
      (attendee) =>
        attendee.self === true && attendee.responseStatus === "declined",
    )
  ) {
    return { kind: "skip", reason: "declined" };
  }

  if (event.transparency === "transparent") {
    return { kind: "skip", reason: "free" };
  }

  const start = parseExplicitDateTime(event.start?.dateTime);
  const end = parseExplicitDateTime(event.end?.dateTime);

  if (!start || !end || end.getTime() <= start.getTime()) {
    return { kind: "skip", reason: "unparseable" };
  }

  return {
    kind: "event",
    value: {
      google_event_id: event.id,
      source_calendar_id: calendarId,
      title: event.summary ?? "(No title)",
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}
