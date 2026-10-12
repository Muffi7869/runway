import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";

import { getAccessToken, GoogleAuthError } from "./access-token";
import {
  createRunwayEvent,
  deleteRunwayEvent,
  GoogleApiError,
  listRunwayEvents,
  updateRunwayEvent,
  type RunwayCalendarEvent,
  type RunwayEventBody,
} from "./calendar-api";
import { ensureRunwayCalendar } from "./runway-calendar";

const DESCRIPTION = "Planned by Runway";
const MAX_CONCURRENCY = 4;

type MirrorBlock = {
  id: string;
  start: string;
  end: string;
  googleEventId: string | null;
  title: string;
};

type MirrorCounts = {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
};

export type MirrorBlocksResult =
  | ({ ok: true } & MirrorCounts)
  | { ok: false; reason: "not_connected" };

export type BlockMirrorDeps = {
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  getAccessToken?: typeof getAccessToken;
  ensureRunwayCalendar?: typeof ensureRunwayCalendar;
  listRunwayEvents?: typeof listRunwayEvents;
  createRunwayEvent?: typeof createRunwayEvent;
  updateRunwayEvent?: typeof updateRunwayEvent;
  deleteRunwayEvent?: typeof deleteRunwayEvent;
};

function isAuthFailure(error: unknown): boolean {
  return (
    (error instanceof GoogleApiError && error.status === 401) ||
    (error instanceof GoogleAuthError &&
      (error.code === "needs_reconnect" || error.code === "token_unreadable"))
  );
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof GoogleApiError &&
    (error.status === 429 || error.status >= 500)
  );
}

async function withRetry<T>(
  operation: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryable(error)) {
      throw error;
    }

    await sleep(100);
    return operation();
  }
}

function sameInstant(first: string, second: string): boolean {
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  return (
    Number.isFinite(firstTime) &&
    Number.isFinite(secondTime) &&
    firstTime === secondTime
  );
}

function eventBody(block: MirrorBlock): RunwayEventBody {
  return {
    summary: block.title,
    description: DESCRIPTION,
    start: { dateTime: new Date(block.start).toISOString(), timeZone: "UTC" },
    end: { dateTime: new Date(block.end).toISOString(), timeZone: "UTC" },
    extendedProperties: { private: { runway_block_id: block.id } },
  };
}

function preferredEvent(
  block: MirrorBlock,
  events: RunwayCalendarEvent[],
): RunwayCalendarEvent {
  const storedMatch = block.googleEventId
    ? events.find((event) => event.id === block.googleEventId)
    : undefined;

  if (storedMatch) {
    return storedMatch;
  }

  return [...events].sort(
    (first, second) =>
      first.created.localeCompare(second.created) ||
      first.id.localeCompare(second.id),
  )[0];
}

async function markNeedsReconnect(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<void> {
  await supabase
    .from("google_connection")
    .update({ status: "needs_reconnect" })
    .eq("user_id", ownerId);
}

async function updateStoredEventId(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  blockId: string,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("blocks")
    .update({ google_event_id: eventId })
    .eq("id", blockId)
    .eq("user_id", ownerId);

  if (error) {
    throw new Error("block event id write failed");
  }
}

// Callers must authenticate the owner before invoking this service.
export async function mirrorBlocks(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  deps: BlockMirrorDeps = {},
): Promise<MirrorBlocksResult> {
  const now = (deps.now ?? (() => new Date()))();
  const sleep =
    deps.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const ensureCalendar = deps.ensureRunwayCalendar ?? ensureRunwayCalendar;
  const accessToken = deps.getAccessToken ?? getAccessToken;
  const listEvents = deps.listRunwayEvents ?? listRunwayEvents;
  const createEvent = deps.createRunwayEvent ?? createRunwayEvent;
  const updateEvent = deps.updateRunwayEvent ?? updateRunwayEvent;
  const deleteEvent = deps.deleteRunwayEvent ?? deleteRunwayEvent;
  const { data: connection, error: connectionError } = await supabase
    .from("google_connection")
    .select("status")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (connectionError || !connection || connection.status !== "connected") {
    return { ok: false, reason: "not_connected" };
  }

  let calendarId: string;

  try {
    calendarId = (await ensureCalendar(supabase, ownerId)).calendarId;
  } catch (error) {
    if (isAuthFailure(error)) {
      await markNeedsReconnect(supabase, ownerId);
    }

    return { ok: false, reason: "not_connected" };
  }

  let token: string;

  try {
    token = await accessToken(supabase, ownerId);
  } catch (error) {
    if (isAuthFailure(error)) {
      await markNeedsReconnect(supabase, ownerId);
      return { ok: false, reason: "not_connected" };
    }

    return { ok: true, created: 0, updated: 0, deleted: 0, failed: 1 };
  }

  const { data: rows, error: blocksError } = await supabase
    .from("blocks")
    .select(
      "id,step_id,start,end,google_event_id,step:steps!inner(name,assignment:assignments!inner(title,class:classes!inner(name)))",
    )
    .eq("user_id", ownerId)
    .eq("status", "planned")
    .gte("start", now.toISOString());

  if (blocksError) {
    return { ok: true, created: 0, updated: 0, deleted: 0, failed: 1 };
  }

  const blocks: MirrorBlock[] = rows.map((row) => ({
    id: row.id,
    start: row.start,
    end: row.end,
    googleEventId: row.google_event_id,
    title: `${row.step.assignment.class.name} · ${row.step.assignment.title} · ${row.step.name}`,
  }));
  let googleEvents: RunwayCalendarEvent[];

  try {
    googleEvents = await withRetry(
      () => listEvents(token, calendarId, now),
      sleep,
    );
  } catch (error) {
    if (isAuthFailure(error)) {
      await markNeedsReconnect(supabase, ownerId);
      return { ok: false, reason: "not_connected" };
    }

    return { ok: true, created: 0, updated: 0, deleted: 0, failed: 1 };
  }

  const eventsByBlock = new Map<string, RunwayCalendarEvent[]>();

  for (const event of googleEvents) {
    if (!event.runwayBlockId) {
      continue;
    }

    const events = eventsByBlock.get(event.runwayBlockId) ?? [];
    events.push(event);
    eventsByBlock.set(event.runwayBlockId, events);
  }

  const counts: MirrorCounts = {
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
  };
  const blockIds = new Set(blocks.map((block) => block.id));
  const tasks: Array<() => Promise<void>> = [];

  for (const block of blocks) {
    const matches = eventsByBlock.get(block.id) ?? [];
    const kept = matches.length > 0 ? preferredEvent(block, matches) : undefined;

    for (const duplicate of matches.filter((event) => event.id !== kept?.id)) {
      tasks.push(async () => {
        try {
          await withRetry(
            () => deleteEvent(token, calendarId, duplicate.id),
            sleep,
          );
          counts.deleted += 1;
        } catch (error) {
          if (
            error instanceof GoogleApiError &&
            (error.status === 404 || error.status === 410)
          ) {
            counts.deleted += 1;
            return;
          }

          throw error;
        }
      });
    }

    tasks.push(async () => {
      if (!kept) {
        const eventId = await withRetry(
          () => createEvent(token, calendarId, eventBody(block)),
          sleep,
        );
        counts.created += 1;
        await updateStoredEventId(supabase, ownerId, block.id, eventId);
        return;
      }

      if (
        kept.summary !== block.title ||
        !sameInstant(kept.start, block.start) ||
        !sameInstant(kept.end, block.end)
      ) {
        await withRetry(
          () => updateEvent(token, calendarId, kept.id, eventBody(block)),
          sleep,
        );
        counts.updated += 1;
      }

      if (block.googleEventId !== kept.id) {
        await updateStoredEventId(supabase, ownerId, block.id, kept.id);
      }
    });
  }

  for (const [runwayBlockId, events] of eventsByBlock) {
    if (blockIds.has(runwayBlockId)) {
      continue;
    }

    for (const event of events) {
      tasks.push(async () => {
        try {
          await withRetry(
            () => deleteEvent(token, calendarId, event.id),
            sleep,
          );
          counts.deleted += 1;
        } catch (error) {
          if (
            error instanceof GoogleApiError &&
            (error.status === 404 || error.status === 410)
          ) {
            counts.deleted += 1;
            return;
          }

          throw error;
        }
      });
    }
  }

  let nextTask = 0;
  let authFailure = false;

  async function worker() {
    while (!authFailure) {
      const taskIndex = nextTask;
      nextTask += 1;

      if (taskIndex >= tasks.length) {
        return;
      }

      try {
        await tasks[taskIndex]();
      } catch (error) {
        if (isAuthFailure(error)) {
          authFailure = true;
          return;
        }

        counts.failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENCY, tasks.length) },
      () => worker(),
    ),
  );

  if (authFailure) {
    await markNeedsReconnect(supabase, ownerId);
    return { ok: false, reason: "not_connected" };
  }

  return { ok: true, ...counts };
}
