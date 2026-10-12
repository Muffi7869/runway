import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/database.types";

vi.mock("server-only", () => ({}));

import { mirrorBlocks, type BlockMirrorDeps } from "./block-mirror";
import {
  GoogleApiError,
  type RunwayCalendarEvent,
  type RunwayEventBody,
} from "./calendar-api";

const OWNER_ID = "test-owner";
const RUNWAY_CALENDAR_ID = "runway-calendar@example.com";
const NOW = new Date("2026-10-20T17:00:00.000Z");

type FakeBlock = {
  id: string;
  user_id: string;
  step_id: string;
  start: string;
  end: string;
  google_event_id: string | null;
  status: string;
  step: {
    name: string;
    assignment: { title: string; class: { name: string } };
  };
};

function block(id: string, overrides: Partial<FakeBlock> = {}): FakeBlock {
  return {
    id,
    user_id: OWNER_ID,
    step_id: `step-${id}`,
    start: "2026-10-21T17:00:00.000Z",
    end: "2026-10-21T18:00:00.000Z",
    google_event_id: null,
    status: "planned",
    step: {
      name: "Write methods",
      assignment: { title: "PA3", class: { name: "CSE 12" } },
    },
    ...overrides,
  };
}

function event(
  id: string,
  runwayBlockId: string | null,
  overrides: Partial<RunwayCalendarEvent> = {},
): RunwayCalendarEvent {
  return {
    id,
    summary: "CSE 12 · PA3 · Write methods",
    description: "Planned by Runway",
    start: "2026-10-21T17:00:00.000Z",
    end: "2026-10-21T18:00:00.000Z",
    created: "2026-10-20T17:00:00.000Z",
    runwayBlockId,
    ...overrides,
  };
}

function makeDatabase(initialBlocks: FakeBlock[], status = "connected") {
  const blocks = initialBlocks.map((row) => structuredClone(row));
  const connection = { status };
  const from = vi.fn((table: string) => {
    if (table === "google_connection") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { status: connection.status },
              error: null,
            })),
          })),
        })),
        update: vi.fn((values: { status: string }) => ({
          eq: vi.fn(async () => {
            connection.status = values.status;
            return { error: null };
          }),
        })),
      };
    }

    if (table === "blocks") {
      return {
        select: vi.fn(() => {
          const filters = new Map<string, unknown>();
          const builder = {
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return builder;
            },
            async gte(_column: string, value: string) {
              return {
                data: blocks
                  .filter(
                    (row) =>
                      row.user_id === filters.get("user_id") &&
                      row.status === filters.get("status") &&
                      Date.parse(row.start) >= Date.parse(value),
                  )
                  .map((row) => structuredClone(row)),
                error: null,
              };
            },
          };
          return builder;
        }),
        update: vi.fn((values: { google_event_id: string }) => {
          const filters = new Map<string, unknown>();
          const builder = {
            eq(column: string, value: unknown) {
              filters.set(column, value);

              if (column !== "user_id") {
                return builder;
              }

              const row = blocks.find(
                (candidate) =>
                  candidate.id === filters.get("id") &&
                  candidate.user_id === filters.get("user_id"),
              );

              if (row) {
                row.google_event_id = values.google_event_id;
              }

              return Promise.resolve({ error: null });
            },
          };
          return builder;
        }),
      };
    }

    throw new Error("Unexpected table");
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    blocks,
    connection,
  };
}

function makeGoogle(initialEvents: RunwayCalendarEvent[] = []) {
  const events = initialEvents.map((item) => ({ ...item }));
  const calendarTargets: string[] = [];
  let nextId = 1;
  const listRunwayEvents = vi.fn(
    async (_token: string, calendarId: string) => {
      calendarTargets.push(calendarId);
      return events.map((item) => ({ ...item }));
    },
  );
  const createRunwayEvent = vi.fn(
    async (_token: string, calendarId: string, body: RunwayEventBody) => {
      calendarTargets.push(calendarId);
      const id = `created-${nextId++}`;
      events.push(
        event(id, body.extendedProperties.private.runway_block_id, {
          summary: body.summary,
          description: body.description,
          start: body.start.dateTime,
          end: body.end.dateTime,
          created: new Date(NOW.getTime() + nextId).toISOString(),
        }),
      );
      return id;
    },
  );
  const updateRunwayEvent = vi.fn(
    async (
      _token: string,
      calendarId: string,
      eventId: string,
      body: RunwayEventBody,
    ) => {
      calendarTargets.push(calendarId);
      const existing = events.find((item) => item.id === eventId);

      if (!existing) {
        throw new GoogleApiError(404, "notFound");
      }

      Object.assign(existing, {
        summary: body.summary,
        description: body.description,
        start: body.start.dateTime,
        end: body.end.dateTime,
        runwayBlockId: body.extendedProperties.private.runway_block_id,
      });
      return eventId;
    },
  );
  const deleteRunwayEvent = vi.fn(
    async (_token: string, calendarId: string, eventId: string) => {
      calendarTargets.push(calendarId);
      const index = events.findIndex((item) => item.id === eventId);

      if (index >= 0) {
        events.splice(index, 1);
      }
    },
  );

  return {
    events,
    calendarTargets,
    listRunwayEvents,
    createRunwayEvent,
    updateRunwayEvent,
    deleteRunwayEvent,
  };
}

function deps(
  google: ReturnType<typeof makeGoogle>,
): BlockMirrorDeps {
  return {
    now: () => NOW,
    sleep: async () => undefined,
    ensureRunwayCalendar: async () => ({
      status: "ready",
      calendarId: RUNWAY_CALENDAR_ID,
      extraRunwayCalendars: 0,
    }),
    getAccessToken: async () => "test-token",
    listRunwayEvents: google.listRunwayEvents,
    createRunwayEvent: google.createRunwayEvent,
    updateRunwayEvent: google.updateRunwayEvent,
    deleteRunwayEvent: google.deleteRunwayEvent,
  };
}

describe("mirrorBlocks", () => {
  it("creates exact events once and stays idempotent across three runs", async () => {
    const database = makeDatabase([block("block-a")]);
    const google = makeGoogle();
    const injected = deps(google);

    const first = await mirrorBlocks(database.client, OWNER_ID, injected);
    const second = await mirrorBlocks(database.client, OWNER_ID, injected);
    const third = await mirrorBlocks(database.client, OWNER_ID, injected);

    expect(first).toEqual({
      ok: true,
      created: 1,
      updated: 0,
      deleted: 0,
      failed: 0,
    });
    expect(second).toEqual({
      ok: true,
      created: 0,
      updated: 0,
      deleted: 0,
      failed: 0,
    });
    expect(third).toEqual(second);
    expect(google.events).toHaveLength(1);
    expect(google.events[0]).toMatchObject({
      summary: "CSE 12 · PA3 · Write methods",
      description: "Planned by Runway",
      runwayBlockId: "block-a",
    });
    expect(database.blocks[0].google_event_id).toBe(google.events[0].id);
    expect(new Set(google.calendarTargets)).toEqual(
      new Set([RUNWAY_CALENDAR_ID]),
    );
  });

  it("updates a moved block without creating another event", async () => {
    const database = makeDatabase([
      block("block-a", {
        google_event_id: "event-a",
        start: "2026-10-21T19:00:00.000Z",
        end: "2026-10-21T20:00:00.000Z",
      }),
    ]);
    const google = makeGoogle([event("event-a", "block-a")]);

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toMatchObject({ ok: true, updated: 1, created: 0 });
    expect(google.events[0].start).toBe("2026-10-21T19:00:00.000Z");
  });

  it("deletes removed and orphaned block events but leaves untagged events", async () => {
    const database = makeDatabase([]);
    const google = makeGoogle([
      event("removed", "removed-block"),
      event("manual", null),
    ]);

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toMatchObject({ ok: true, deleted: 1 });
    expect(google.events.map((item) => item.id)).toEqual(["manual"]);
  });

  it("collapses duplicate block events and keeps the stored event id", async () => {
    const database = makeDatabase([
      block("block-a", { google_event_id: "stored-event" }),
    ]);
    const google = makeGoogle([
      event("older-event", "block-a", {
        created: "2026-10-19T17:00:00.000Z",
      }),
      event("stored-event", "block-a", {
        created: "2026-10-20T17:00:00.000Z",
      }),
    ]);

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toMatchObject({ ok: true, deleted: 1 });
    expect(google.events.map((item) => item.id)).toEqual(["stored-event"]);
  });

  it("recovers on the next run after a persistent create failure midway", async () => {
    const database = makeDatabase([
      block("block-a"),
      block("block-b"),
      block("block-c"),
    ]);
    const google = makeGoogle();
    const originalCreate = google.createRunwayEvent;
    let failThirdBlock = true;
    google.createRunwayEvent = vi.fn(async (...args) => {
      if (
        failThirdBlock &&
        args[2].extendedProperties.private.runway_block_id === "block-c"
      ) {
        throw new GoogleApiError(500, "backendError");
      }

      return originalCreate(...args);
    });
    const injected = deps(google);

    await expect(
      mirrorBlocks(database.client, OWNER_ID, injected),
    ).resolves.toMatchObject({ ok: true, created: 2, failed: 1 });
    failThirdBlock = false;
    await expect(
      mirrorBlocks(database.client, OWNER_ID, injected),
    ).resolves.toMatchObject({ ok: true, created: 1, failed: 0 });
    expect(google.events).toHaveLength(3);
    expect(new Set(google.events.map((item) => item.runwayBlockId)).size).toBe(3);
  });

  it("marks reconnect and stops on an authentication failure", async () => {
    const database = makeDatabase([block("block-a")]);
    const google = makeGoogle();
    google.createRunwayEvent = vi.fn(async () => {
      throw new GoogleApiError(401, "authError");
    });

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toEqual({ ok: false, reason: "not_connected" });
    expect(database.connection.status).toBe("needs_reconnect");
  });

  it("counts a persistent server failure without changing connection status", async () => {
    const database = makeDatabase([block("block-a")]);
    const google = makeGoogle();
    google.createRunwayEvent = vi.fn(async () => {
      throw new GoogleApiError(500, "backendError");
    });

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toMatchObject({ ok: true, failed: 1 });
    expect(database.connection.status).toBe("connected");
  });

  it("treats a 410 while deleting an orphan as success", async () => {
    const database = makeDatabase([]);
    const google = makeGoogle([event("gone", "orphan")]);
    google.deleteRunwayEvent = vi.fn(async () => {
      throw new GoogleApiError(410, "gone");
    });

    await expect(
      mirrorBlocks(database.client, OWNER_ID, deps(google)),
    ).resolves.toEqual({
      ok: true,
      created: 0,
      updated: 0,
      deleted: 1,
      failed: 0,
    });
  });
});
