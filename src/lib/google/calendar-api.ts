import type { GoogleEventInput } from "./event-mapper";

const CALENDAR_API_ROOT = "https://www.googleapis.com/calendar/v3";
const CALENDAR_LIST_FIELDS =
  "items(id,summary,summaryOverride,primary,accessRole,deleted),nextPageToken";
const EVENT_LIST_FIELDS =
  "items(id,status,summary,eventType,start,end,transparency,attendees(self,responseStatus)),nextPageToken";
const MAX_CALENDAR_LIST_PAGES = 10;
const MAX_EVENT_LIST_PAGES = 20;

export type GoogleCalendar = {
  id: string;
  name: string;
  summary: string;
  primary: boolean;
  accessRole: string;
};

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | undefined,
  ) {
    super(`Google Calendar API request failed with status ${status}.`);
    this.name = "GoogleApiError";
  }
}

type GoogleErrorResponse = {
  error?: {
    errors?: Array<{ reason?: unknown }>;
  };
};

async function getErrorReason(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as GoogleErrorResponse;
    const reason = body.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : undefined;
  } catch {
    return undefined;
  }
}

async function throwGoogleApiError(response: Response): Promise<never> {
  throw new GoogleApiError(response.status, await getErrorReason(response));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GoogleApiError(response.status, undefined);
  }
}

function eventDateTime(value: unknown): GoogleEventInput["start"] | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const source = value as {
    dateTime?: unknown;
    date?: unknown;
    timeZone?: unknown;
  };

  return {
    ...(typeof source.dateTime === "string"
      ? { dateTime: source.dateTime }
      : {}),
    ...(typeof source.date === "string" ? { date: source.date } : {}),
    ...(typeof source.timeZone === "string"
      ? { timeZone: source.timeZone }
      : {}),
  };
}

function googleEvent(value: unknown): GoogleEventInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const source = value as {
    id?: unknown;
    status?: unknown;
    summary?: unknown;
    eventType?: unknown;
    transparency?: unknown;
    start?: unknown;
    end?: unknown;
    attendees?: unknown;
  };

  if (typeof source.id !== "string") {
    return null;
  }

  const attendees = Array.isArray(source.attendees)
    ? source.attendees
        .filter(
          (attendee): attendee is Record<string, unknown> =>
            typeof attendee === "object" && attendee !== null,
        )
        .map((attendee) => ({
          ...(typeof attendee.self === "boolean"
            ? { self: attendee.self }
            : {}),
          ...(typeof attendee.responseStatus === "string"
            ? { responseStatus: attendee.responseStatus }
            : {}),
        }))
    : undefined;

  return {
    id: source.id,
    ...(typeof source.status === "string" ? { status: source.status } : {}),
    ...(typeof source.summary === "string" ? { summary: source.summary } : {}),
    ...(typeof source.eventType === "string"
      ? { eventType: source.eventType }
      : {}),
    ...(typeof source.transparency === "string"
      ? { transparency: source.transparency }
      : {}),
    ...(source.start ? { start: eventDateTime(source.start) } : {}),
    ...(source.end ? { end: eventDateTime(source.end) } : {}),
    ...(attendees ? { attendees } : {}),
  };
}

export async function listCalendars(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleCalendar[]> {
  const calendars: GoogleCalendar[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_CALENDAR_LIST_PAGES; page += 1) {
    const url = new URL(`${CALENDAR_API_ROOT}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("showHidden", "true");
    url.searchParams.set("fields", CALENDAR_LIST_FIELDS);

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      await throwGoogleApiError(response);
    }

    const body = await readJson(response);
    const data =
      typeof body === "object" && body !== null
        ? (body as { items?: unknown; nextPageToken?: unknown })
        : {};
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const calendar = item as {
        id?: unknown;
        summary?: unknown;
        summaryOverride?: unknown;
        primary?: unknown;
        accessRole?: unknown;
        deleted?: unknown;
      };

      if (calendar.deleted === true || typeof calendar.id !== "string") {
        continue;
      }

      const summary =
        typeof calendar.summary === "string" ? calendar.summary : "";
      const name =
        typeof calendar.summaryOverride === "string"
          ? calendar.summaryOverride
          : summary;

      calendars.push({
        id: calendar.id,
        name,
        summary,
        primary: calendar.primary === true,
        accessRole:
          typeof calendar.accessRole === "string" ? calendar.accessRole : "",
      });
    }

    pageToken =
      typeof data.nextPageToken === "string" && data.nextPageToken
        ? data.nextPageToken
        : undefined;

    if (!pageToken) {
      break;
    }
  }

  return calendars;
}

export async function createCalendar(
  token: string,
  calendar: { summary: string; timeZone: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(`${CALENDAR_API_ROOT}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(calendar),
  });

  if (!response.ok) {
    await throwGoogleApiError(response);
  }

  const body = await readJson(response);
  const id =
    typeof body === "object" && body !== null && "id" in body
      ? (body as { id?: unknown }).id
      : undefined;

  if (typeof id !== "string" || !id) {
    throw new GoogleApiError(response.status, undefined);
  }

  return id;
}

export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleEventInput[]> {
  const events: GoogleEventInput[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_EVENT_LIST_PAGES; page += 1) {
    const encodedCalendarId = encodeURIComponent(calendarId);
    const url = new URL(
      `${CALENDAR_API_ROOT}/calendars/${encodedCalendarId}/events`,
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("maxResults", "2500");
    url.searchParams.set("timeZone", "UTC");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("fields", EVENT_LIST_FIELDS);

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      await throwGoogleApiError(response);
    }

    const body = await readJson(response);
    const data =
      typeof body === "object" && body !== null
        ? (body as { items?: unknown; nextPageToken?: unknown })
        : {};
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      const event = googleEvent(item);

      if (event) {
        events.push(event);
      }
    }

    pageToken =
      typeof data.nextPageToken === "string" && data.nextPageToken
        ? data.nextPageToken
        : undefined;

    if (!pageToken) {
      break;
    }
  }

  return events;
}

export function isRunwayCalendarCandidate(calendar: GoogleCalendar): boolean {
  return (
    calendar.accessRole === "owner" &&
    !calendar.primary &&
    calendar.summary.trim() === "Runway"
  );
}
