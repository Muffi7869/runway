import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";

import { getAccessToken, GoogleAuthError } from "./access-token";
import {
  createCalendar,
  isRunwayCalendarCandidate,
  listCalendars,
  type GoogleCalendar,
} from "./calendar-api";

type EnsureRunwayCalendarDeps = {
  getAccessToken?: typeof getAccessToken;
  listCalendars?: typeof listCalendars;
  createCalendar?: typeof createCalendar;
};

export type EnsureRunwayCalendarResult = {
  status: "ready" | "adopted" | "created";
  calendarId: string;
  extraRunwayCalendars: number;
};

type Connection = {
  runway_calendar_id: string | null;
  status: string;
};

async function readConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Connection> {
  const { data, error } = await supabase
    .from("google_connection")
    .select("runway_calendar_id,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new GoogleAuthError("google_unavailable");
  }

  if (!data || data.status !== "connected") {
    throw new GoogleAuthError("needs_reconnect");
  }

  return data;
}

async function compareAndSetCalendarId(
  supabase: SupabaseClient<Database>,
  userId: string,
  expected: string | null,
  calendarId: string,
): Promise<boolean> {
  let query = supabase
    .from("google_connection")
    .update({ runway_calendar_id: calendarId })
    .eq("user_id", userId);

  query = expected
    ? query.eq("runway_calendar_id", expected)
    : query.is("runway_calendar_id", null);

  const { data, error } = await query.select("runway_calendar_id");

  if (error) {
    throw new GoogleAuthError("google_unavailable");
  }

  return data.length === 1;
}

function runwayCandidates(calendars: GoogleCalendar[]): GoogleCalendar[] {
  return calendars
    .filter(isRunwayCalendarCandidate)
    .sort((first, second) =>
      first.id < second.id ? -1 : first.id > second.id ? 1 : 0,
    );
}

async function readyAfterConcurrentSave({
  supabase,
  userId,
  token,
  listCalendarsImpl,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  token: string;
  listCalendarsImpl: typeof listCalendars;
}): Promise<EnsureRunwayCalendarResult> {
  const connection = await readConnection(supabase, userId);

  if (!connection.runway_calendar_id) {
    throw new GoogleAuthError("google_unavailable");
  }

  const calendars = await listCalendarsImpl(token);
  const candidates = runwayCandidates(calendars);

  return {
    status: "ready",
    calendarId: connection.runway_calendar_id,
    extraRunwayCalendars: candidates.filter(
      (calendar) => calendar.id !== connection.runway_calendar_id,
    ).length,
  };
}

// Callers must run requireOwner() before calling this helper.
export async function ensureRunwayCalendar(
  supabase: SupabaseClient<Database>,
  userId: string,
  deps: EnsureRunwayCalendarDeps = {},
): Promise<EnsureRunwayCalendarResult> {
  const getAccessTokenImpl = deps.getAccessToken ?? getAccessToken;
  const listCalendarsImpl = deps.listCalendars ?? listCalendars;
  const createCalendarImpl = deps.createCalendar ?? createCalendar;
  const connection = await readConnection(supabase, userId);
  const token = await getAccessTokenImpl(supabase, userId);
  const calendars = await listCalendarsImpl(token);
  const candidates = runwayCandidates(calendars);
  const storedId = connection.runway_calendar_id?.trim() || null;

  if (
    storedId &&
    calendars.some((calendar) => calendar.id === storedId)
  ) {
    return {
      status: "ready",
      calendarId: storedId,
      extraRunwayCalendars: candidates.filter(
        (calendar) => calendar.id !== storedId,
      ).length,
    };
  }

  const expected = connection.runway_calendar_id;

  if (candidates.length) {
    const adoptedId = candidates[0].id;
    const saved = await compareAndSetCalendarId(
      supabase,
      userId,
      expected,
      adoptedId,
    );

    if (saved) {
      return {
        status: "adopted",
        calendarId: adoptedId,
        extraRunwayCalendars: candidates.length - 1,
      };
    }

    return readyAfterConcurrentSave({
      supabase,
      userId,
      token,
      listCalendarsImpl,
    });
  }

  const createdId = await createCalendarImpl(token, {
    summary: "Runway",
    timeZone: "America/Los_Angeles",
  });
  const saved = await compareAndSetCalendarId(
    supabase,
    userId,
    expected,
    createdId,
  );

  if (saved) {
    return {
      status: "created",
      calendarId: createdId,
      extraRunwayCalendars: 0,
    };
  }

  return readyAfterConcurrentSave({
    supabase,
    userId,
    token,
    listCalendarsImpl,
  });
}
