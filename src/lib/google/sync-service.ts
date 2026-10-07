import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";
import { syncWindow } from "../time/zoned";

import { getAccessToken, GoogleAuthError } from "./access-token";
import { GoogleApiError, listEvents } from "./calendar-api";
import {
  mapGoogleEvent,
  type FixedEventValue,
} from "./event-mapper";
import { planSync, type ExistingFixedEvent } from "./sync-planner";

const UPSERT_CHUNK_SIZE = 500;
const DELETE_CHUNK_SIZE = 200;
const FIXED_EVENT_COLUMNS =
  "id,source_calendar_id,google_event_id,title,start,end";

export type SyncFailureReason =
  | "needs_reconnect"
  | "no_calendars"
  | "calendar_unavailable"
  | "google_unavailable"
  | "write_failed";

export type SyncFixedEventsResult =
  | {
      ok: true;
      inserted: number;
      updated: number;
      removed: number;
      unreadable: number;
    }
  | { ok: false; reason: SyncFailureReason };

export type SyncFixedEventsDeps = {
  getAccessToken?: typeof getAccessToken;
  listEvents?: typeof listEvents;
  mapGoogleEvent?: typeof mapGoogleEvent;
  syncWindow?: typeof syncWindow;
};

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

function eventKey(event: {
  source_calendar_id: string;
  google_event_id: string;
}): string {
  return JSON.stringify([event.source_calendar_id, event.google_event_id]);
}

function googleFailureReason(error: unknown): SyncFailureReason {
  if (error instanceof GoogleApiError) {
    if (error.status === 401) {
      return "needs_reconnect";
    }

    if (error.status === 404 || error.status === 410) {
      return "calendar_unavailable";
    }
  }

  return "google_unavailable";
}

async function markNeedsReconnect(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  await supabase
    .from("google_connection")
    .update({ status: "needs_reconnect" })
    .eq("user_id", userId);
}

export async function syncFixedEvents({
  supabase,
  userId,
  now,
  deps = {},
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  now: Date;
  deps?: SyncFixedEventsDeps;
}): Promise<SyncFixedEventsResult> {
  const getAccessTokenImpl = deps.getAccessToken ?? getAccessToken;
  const listEventsImpl = deps.listEvents ?? listEvents;
  const mapGoogleEventImpl = deps.mapGoogleEvent ?? mapGoogleEvent;
  const syncWindowImpl = deps.syncWindow ?? syncWindow;
  const { data: connection, error: connectionError } = await supabase
    .from("google_connection")
    .select("status,fixed_calendar_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (connectionError) {
    return { ok: false, reason: "write_failed" };
  }

  if (!connection || connection.status !== "connected") {
    return { ok: false, reason: "needs_reconnect" };
  }

  if (connection.fixed_calendar_ids.length === 0) {
    return { ok: false, reason: "no_calendars" };
  }

  let token: string;

  try {
    token = await getAccessTokenImpl(supabase, userId);
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      if (
        error.code === "needs_reconnect" ||
        error.code === "token_unreadable"
      ) {
        return { ok: false, reason: "needs_reconnect" };
      }
    }

    return { ok: false, reason: "google_unavailable" };
  }

  const { timeMin, timeMax } = syncWindowImpl(now);
  const incoming: FixedEventValue[] = [];
  let unreadable = 0;

  try {
    for (const calendarId of connection.fixed_calendar_ids) {
      const events = await listEventsImpl(
        token,
        calendarId,
        timeMin,
        timeMax,
      );

      for (const event of events) {
        const mapped = mapGoogleEventImpl(event, calendarId);

        if (mapped.kind === "event") {
          incoming.push(mapped.value);
        } else if (mapped.reason === "unparseable") {
          unreadable += 1;
        }
      }
    }
  } catch (error) {
    const reason = googleFailureReason(error);

    if (reason === "needs_reconnect") {
      await markNeedsReconnect(supabase, userId);
    }

    return { ok: false, reason };
  }

  const { data: existingData, error: existingError } = await supabase
    .from("fixed_events")
    .select(FIXED_EVENT_COLUMNS)
    .eq("user_id", userId)
    .gt("end", timeMin.toISOString())
    .lt("start", timeMax.toISOString());

  if (existingError) {
    return { ok: false, reason: "write_failed" };
  }

  const existing = existingData as ExistingFixedEvent[];
  const plan = planSync({
    existing,
    incoming,
    selectedCalendarIds: connection.fixed_calendar_ids,
  });
  const incomingByKey = new Map(
    incoming.map((event) => [eventKey(event), event]),
  );
  const existingById = new Map(existing.map((event) => [event.id, event]));
  const changedEvents = plan.updates.flatMap((update) => {
    const current = existingById.get(update.id);
    const replacement = current
      ? incomingByKey.get(eventKey(current))
      : undefined;
    return replacement ? [replacement] : [];
  });
  const upsertRows = [...plan.inserts, ...changedEvents].map((event) => ({
    user_id: userId,
    source_calendar_id: event.source_calendar_id,
    google_event_id: event.google_event_id,
    title: event.title,
    start: event.start,
    end: event.end,
  }));

  for (const batch of chunks(upsertRows, UPSERT_CHUNK_SIZE)) {
    const { error } = await supabase.from("fixed_events").upsert(batch, {
      onConflict: "user_id,source_calendar_id,google_event_id",
    });

    if (error) {
      return { ok: false, reason: "write_failed" };
    }
  }

  for (const batch of chunks(plan.deletes, DELETE_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("fixed_events")
      .delete()
      .eq("user_id", userId)
      .in("id", batch);

    if (error) {
      return { ok: false, reason: "write_failed" };
    }
  }

  const { error: syncedAtError } = await supabase
    .from("google_connection")
    .update({ last_synced_at: now.toISOString() })
    .eq("user_id", userId);

  if (syncedAtError) {
    return { ok: false, reason: "write_failed" };
  }

  return {
    ok: true,
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    removed: plan.deletes.length,
    unreadable,
  };
}
