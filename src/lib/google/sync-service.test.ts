import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/database.types";

vi.mock("server-only", () => ({}));

import { GoogleApiError } from "./calendar-api";
import type { GoogleEventInput } from "./event-mapper";
import type { ExistingFixedEvent } from "./sync-planner";
import {
  syncFixedEvents,
  type SyncFixedEventsDeps,
} from "./sync-service";

const USER_ID = "test-user";
const CALENDAR_A = "calendar-a@example.com";
const CALENDAR_B = "calendar-b@example.com";
const NOW = new Date("2026-10-27T19:00:00.000Z");

type Connection = {
  status: string;
  fixed_calendar_ids: string[];
  last_synced_at: string | null;
};

type StoredFixedEvent = ExistingFixedEvent & { user_id: string };

function timedEvent(
  id: string,
  overrides: Partial<GoogleEventInput> = {},
): GoogleEventInput {
  return {
    id,
    summary: "Test Class A",
    start: { dateTime: "2026-10-27T10:00:00-07:00" },
    end: { dateTime: "2026-10-27T11:00:00-07:00" },
    ...overrides,
  };
}

function storedEvent(
  id: string,
  googleEventId: string,
  overrides: Partial<StoredFixedEvent> = {},
): StoredFixedEvent {
  return {
    id,
    user_id: USER_ID,
    source_calendar_id: CALENDAR_A,
    google_event_id: googleEventId,
    title: "Test Class A",
    start: "2026-10-27T17:00:00.000Z",
    end: "2026-10-27T18:00:00.000Z",
    ...overrides,
  };
}

function makeDatabase({
  connection = {
    status: "connected",
    fixed_calendar_ids: [CALENDAR_A],
    last_synced_at: null,
  },
  fixedEvents = [],
  failUpsert = false,
  failDelete = false,
}: {
  connection?: Connection;
  fixedEvents?: StoredFixedEvent[];
  failUpsert?: boolean;
  failDelete?: boolean;
} = {}) {
  const connectionRow = { ...connection };
  let rows = fixedEvents.map((event) => ({ ...event }));
  let nextId = 1;
  const upsertBatches: Array<Array<Record<string, unknown>>> = [];
  const deleteBatches: string[][] = [];
  const lastSyncedUpdates: string[] = [];
  const statusUpdates: string[] = [];
  let fixedSelectCalls = 0;

  const from = vi.fn((table: string) => {
    if (table === "google_connection") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                status: connectionRow.status,
                fixed_calendar_ids: [...connectionRow.fixed_calendar_ids],
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(
          (values: {
            status?: string;
            last_synced_at?: string;
          }) => ({
            eq: vi.fn(async () => {
              if (values.status) {
                connectionRow.status = values.status;
                statusUpdates.push(values.status);
              }

              if (values.last_synced_at) {
                connectionRow.last_synced_at = values.last_synced_at;
                lastSyncedUpdates.push(values.last_synced_at);
              }

              return { error: null };
            }),
          }),
        ),
      };
    }

    if (table === "fixed_events") {
      return {
        select: vi.fn(() => {
          const filters: { timeMin?: string; timeMax?: string } = {};
          const builder = {
            eq() {
              return builder;
            },
            gt(_column: string, value: string) {
              filters.timeMin = value;
              return builder;
            },
            async lt(_column: string, value: string) {
              filters.timeMax = value;
              fixedSelectCalls += 1;
              const data = rows.filter(
                (event) =>
                  Date.parse(event.end) > Date.parse(filters.timeMin ?? "") &&
                  Date.parse(event.start) < Date.parse(filters.timeMax ?? ""),
              );
              return { data: data.map((event) => ({ ...event })), error: null };
            },
          };

          return builder;
        }),
        upsert: vi.fn(
          async (
            values: Array<{
              user_id: string;
              source_calendar_id: string;
              google_event_id: string;
              title: string;
              start: string;
              end: string;
            }>,
          ) => {
            upsertBatches.push(values.map((value) => ({ ...value })));

            if (failUpsert) {
              return { error: new Error("write failed") };
            }

            for (const value of values) {
              const index = rows.findIndex(
                (row) =>
                  row.user_id === value.user_id &&
                  row.source_calendar_id === value.source_calendar_id &&
                  row.google_event_id === value.google_event_id,
              );

              if (index >= 0) {
                rows[index] = { ...rows[index], ...value };
              } else {
                rows.push({ id: `new-row-${nextId++}`, ...value });
              }
            }

            return { error: null };
          },
        ),
        delete: vi.fn(() => {
          const builder = {
            eq() {
              return builder;
            },
            async in(_column: string, ids: string[]) {
              deleteBatches.push([...ids]);

              if (failDelete) {
                return { error: new Error("delete failed") };
              }

              const deletedIds = new Set(ids);
              rows = rows.filter((row) => !deletedIds.has(row.id));
              return { error: null };
            },
          };

          return builder;
        }),
      };
    }

    throw new Error("Unexpected table.");
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    connection: connectionRow,
    fixedEvents: () => rows.map((event) => ({ ...event })),
    fixedSelectCalls: () => fixedSelectCalls,
    upsertBatches,
    deleteBatches,
    lastSyncedUpdates,
    statusUpdates,
  };
}

function makeDeps(
  events: Record<string, GoogleEventInput[] | Error>,
): Required<Pick<SyncFixedEventsDeps, "getAccessToken" | "listEvents">> {
  return {
    getAccessToken: vi.fn(async () => "test-access-token"),
    listEvents: vi.fn(async (_token, calendarId) => {
      const result = events[calendarId] ?? [];

      if (result instanceof Error) {
        throw result;
      }

      return result;
    }),
  };
}

describe("syncFixedEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts new and changed events, deletes removed events, and records the sync time", async () => {
    const database = makeDatabase({
      fixedEvents: [
        storedEvent("changed-row", "changed-event", { title: "Old title" }),
        storedEvent("removed-row", "removed-event"),
      ],
    });
    const deps = makeDeps({
      [CALENDAR_A]: [
        timedEvent("changed-event", { summary: "Test Class B" }),
        timedEvent("new-event", {
          summary: "Test Class C",
          start: { dateTime: "2026-10-28T10:00:00-07:00" },
          end: { dateTime: "2026-10-28T11:00:00-07:00" },
        }),
      ],
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({
      ok: true,
      inserted: 1,
      updated: 1,
      removed: 1,
      unreadable: 0,
    });
    expect(database.upsertBatches).toHaveLength(1);
    expect(database.upsertBatches[0]).toHaveLength(2);
    expect(database.deleteBatches).toEqual([["removed-row"]]);
    expect(database.lastSyncedUpdates).toEqual([NOW.toISOString()]);
    expect(database.fixedEvents()).toHaveLength(2);
  });

  it("does not write fixed events again when the same sync runs twice", async () => {
    const database = makeDatabase();
    const deps = makeDeps({ [CALENDAR_A]: [timedEvent("same-event")] });

    await syncFixedEvents({
      supabase: database.client,
      userId: USER_ID,
      now: NOW,
      deps,
    });
    const fixedWriteCount =
      database.upsertBatches.length + database.deleteBatches.length;

    await syncFixedEvents({
      supabase: database.client,
      userId: USER_ID,
      now: new Date(NOW.getTime() + 60_000),
      deps,
    });

    expect(database.upsertBatches.length + database.deleteBatches.length).toBe(
      fixedWriteCount,
    );
  });

  it("returns needs_reconnect without touching events or last_synced_at", async () => {
    const existing = storedEvent("existing-row", "existing-event");
    const database = makeDatabase({
      connection: {
        status: "needs_reconnect",
        fixed_calendar_ids: [CALENDAR_A],
        last_synced_at: null,
      },
      fixedEvents: [existing],
    });
    const deps = makeDeps({ [CALENDAR_A]: [] });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "needs_reconnect" });
    expect(deps.getAccessToken).not.toHaveBeenCalled();
    expect(database.fixedEvents()).toEqual([existing]);
    expect(database.lastSyncedUpdates).toEqual([]);
  });

  it("writes nothing when any calendar fetch fails", async () => {
    const existing = storedEvent("existing-row", "existing-event");
    const database = makeDatabase({
      connection: {
        status: "connected",
        fixed_calendar_ids: [CALENDAR_A, CALENDAR_B],
        last_synced_at: null,
      },
      fixedEvents: [existing],
    });
    const deps = makeDeps({
      [CALENDAR_A]: [timedEvent("new-event")],
      [CALENDAR_B]: new GoogleApiError(500, "backendError"),
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "google_unavailable" });
    expect(database.fixedSelectCalls()).toBe(0);
    expect(database.upsertBatches).toEqual([]);
    expect(database.deleteBatches).toEqual([]);
    expect(database.fixedEvents()).toEqual([existing]);
    expect(database.lastSyncedUpdates).toEqual([]);
  });

  it("returns calendar_unavailable and writes nothing for a 404", async () => {
    const database = makeDatabase();
    const deps = makeDeps({
      [CALENDAR_A]: new GoogleApiError(404, "notFound"),
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "calendar_unavailable" });
    expect(database.upsertBatches).toEqual([]);
    expect(database.deleteBatches).toEqual([]);
    expect(database.lastSyncedUpdates).toEqual([]);
  });

  it("marks the connection for reconnect and writes no events for a 401", async () => {
    const database = makeDatabase();
    const deps = makeDeps({
      [CALENDAR_A]: new GoogleApiError(401, "authError"),
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "needs_reconnect" });
    expect(database.statusUpdates).toEqual(["needs_reconnect"]);
    expect(database.upsertBatches).toEqual([]);
    expect(database.deleteBatches).toEqual([]);
  });

  it("does not update last_synced_at when an event write fails", async () => {
    const database = makeDatabase({ failUpsert: true });
    const deps = makeDeps({ [CALENDAR_A]: [timedEvent("new-event")] });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "write_failed" });
    expect(database.lastSyncedUpdates).toEqual([]);
    expect(database.deleteBatches).toEqual([]);
  });

  it("returns no_calendars without making a Google call", async () => {
    const database = makeDatabase({
      connection: {
        status: "connected",
        fixed_calendar_ids: [],
        last_synced_at: null,
      },
    });
    const deps = makeDeps({});

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toEqual({ ok: false, reason: "no_calendars" });
    expect(deps.getAccessToken).not.toHaveBeenCalled();
    expect(deps.listEvents).not.toHaveBeenCalled();
    expect(database.fixedSelectCalls()).toBe(0);
  });

  it("counts unparseable events without saving them", async () => {
    const database = makeDatabase();
    const deps = makeDeps({
      [CALENDAR_A]: [
        timedEvent("good-event"),
        timedEvent("bad-event", {
          start: { dateTime: "not-a-time" },
        }),
      ],
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toMatchObject({ ok: true, inserted: 1, unreadable: 1 });
    expect(database.fixedEvents()).toHaveLength(1);
  });

  it("skips non-busy events while keeping out-of-office and focus time", async () => {
    const database = makeDatabase();
    const deps = makeDeps({
      [CALENDAR_A]: [
        timedEvent("all-day", {
          start: { date: "2026-10-27" },
          end: { date: "2026-10-28" },
        }),
        timedEvent("declined", {
          attendees: [{ self: true, responseStatus: "declined" }],
        }),
        timedEvent("free", { transparency: "transparent" }),
        timedEvent("working-location", { eventType: "workingLocation" }),
        timedEvent("out-of-office", { eventType: "outOfOffice" }),
        timedEvent("focus-time", { eventType: "focusTime" }),
      ],
    });

    await expect(
      syncFixedEvents({
        supabase: database.client,
        userId: USER_ID,
        now: NOW,
        deps,
      }),
    ).resolves.toMatchObject({ ok: true, inserted: 2, unreadable: 0 });
    expect(
      database.fixedEvents().map((event) => event.google_event_id).sort(),
    ).toEqual(["focus-time", "out-of-office"]);
  });
});
