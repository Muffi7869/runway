import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/database.types";

vi.mock("server-only", () => ({}));

import { GoogleAuthError } from "./access-token";
import type { GoogleCalendar } from "./calendar-api";
import { ensureRunwayCalendar } from "./runway-calendar";

type ConnectionRow = {
  runway_calendar_id: string | null;
  status: string;
};

function calendar(
  id: string,
  overrides: Partial<GoogleCalendar> = {},
): GoogleCalendar {
  return {
    id,
    name: "Runway",
    summary: "Runway",
    primary: false,
    accessRole: "owner",
    ...overrides,
  };
}

function makeDatabase(
  initialRow: ConnectionRow,
  options: { raceWinnerId?: string } = {},
) {
  let row = { ...initialRow };
  let raceApplied = false;
  const writes: string[] = [];
  const updateCalls: string[] = [];

  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { ...row }, error: null })),
      })),
    })),
    update: vi.fn((values: { runway_calendar_id: string }) => {
      updateCalls.push(values.runway_calendar_id);
      const filters = new Map<string, unknown>();
      const builder = {
        eq(column: string, value: unknown) {
          filters.set(column, value);
          return builder;
        },
        is(column: string, value: unknown) {
          filters.set(column, value);
          return builder;
        },
        async select() {
          if (options.raceWinnerId && !raceApplied) {
            row.runway_calendar_id = options.raceWinnerId;
            raceApplied = true;
          }

          const userMatches = filters.get("user_id") === "test-user";
          const expected = filters.get("runway_calendar_id");
          const idMatches = row.runway_calendar_id === expected;

          if (!userMatches || !idMatches) {
            return { data: [], error: null };
          }

          row = { ...row, ...values };
          writes.push(values.runway_calendar_id);
          return {
            data: [{ runway_calendar_id: values.runway_calendar_id }],
            error: null,
          };
        },
      };

      return builder;
    }),
  }));

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    getRow: () => ({ ...row }),
    updateCalls,
    writes,
  };
}

function makeDeps(calendarPages: GoogleCalendar[][]) {
  let page = 0;
  const getAccessToken = vi.fn(async () => "test-access-token");
  const listCalendars = vi.fn(async () => {
    const calendars = calendarPages[Math.min(page, calendarPages.length - 1)];
    page += 1;
    return calendars;
  });
  const createCalendar = vi.fn(async () => "created@example.com");

  return { getAccessToken, listCalendars, createCalendar };
}

async function expectGoogleAuthError(
  action: Promise<unknown>,
  code: GoogleAuthError["code"],
) {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(GoogleAuthError);
    expect((error as GoogleAuthError).code).toBe(code);
    return;
  }

  throw new Error("Expected GoogleAuthError.");
}

describe("ensureRunwayCalendar", () => {
  it("creates once and stores the id when no candidate exists", async () => {
    const database = makeDatabase({
      runway_calendar_id: null,
      status: "connected",
    });
    const deps = makeDeps([[]]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "created",
      calendarId: "created@example.com",
      extraRunwayCalendars: 0,
    });
    expect(deps.createCalendar).toHaveBeenCalledOnce();
    expect(deps.listCalendars).toHaveBeenCalledOnce();
    expect(deps.createCalendar).toHaveBeenCalledWith("test-access-token", {
      summary: "Runway",
      timeZone: "America/Los_Angeles",
    });
    expect(database.writes).toEqual(["created@example.com"]);
  });

  it("adopts an existing candidate without creating", async () => {
    const database = makeDatabase({
      runway_calendar_id: null,
      status: "connected",
    });
    const deps = makeDeps([[calendar("existing@example.com")]]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "adopted",
      calendarId: "existing@example.com",
      extraRunwayCalendars: 0,
    });
    expect(deps.createCalendar).not.toHaveBeenCalled();
    expect(deps.listCalendars).toHaveBeenCalledOnce();
    expect(database.writes).toEqual(["existing@example.com"]);
  });

  it("adopts the lowest candidate id and reports an extra", async () => {
    const database = makeDatabase({
      runway_calendar_id: null,
      status: "connected",
    });
    const deps = makeDeps([
      [calendar("z-calendar@example.com"), calendar("a-calendar@example.com")],
    ]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "adopted",
      calendarId: "a-calendar@example.com",
      extraRunwayCalendars: 1,
    });
    expect(database.writes).toEqual(["a-calendar@example.com"]);
  });

  it("returns ready without creating or writing when the stored id exists", async () => {
    const database = makeDatabase({
      runway_calendar_id: "stored@example.com",
      status: "connected",
    });
    const deps = makeDeps([
      [
        calendar("stored@example.com", {
          summary: "Different",
          name: "Different",
          accessRole: "reader",
        }),
        calendar("extra@example.com"),
      ],
    ]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "ready",
      calendarId: "stored@example.com",
      extraRunwayCalendars: 1,
    });
    expect(deps.createCalendar).not.toHaveBeenCalled();
    expect(deps.listCalendars).toHaveBeenCalledOnce();
    expect(database.updateCalls).toEqual([]);
  });

  it("replaces a missing stored id by creating once", async () => {
    const database = makeDatabase({
      runway_calendar_id: "missing@example.com",
      status: "connected",
    });
    const deps = makeDeps([[]]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "created",
      calendarId: "created@example.com",
      extraRunwayCalendars: 0,
    });
    expect(deps.createCalendar).toHaveBeenCalledOnce();
    expect(database.writes).toEqual(["created@example.com"]);
  });

  it("replaces a missing stored id by adopting a candidate", async () => {
    const database = makeDatabase({
      runway_calendar_id: "missing@example.com",
      status: "connected",
    });
    const deps = makeDeps([[calendar("existing@example.com")]]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "adopted",
      calendarId: "existing@example.com",
      extraRunwayCalendars: 0,
    });
    expect(deps.createCalendar).not.toHaveBeenCalled();
    expect(database.writes).toEqual(["existing@example.com"]);
  });

  it("returns the concurrent winner without overwriting it", async () => {
    const database = makeDatabase(
      { runway_calendar_id: null, status: "connected" },
      { raceWinnerId: "winner@example.com" },
    );
    const deps = makeDeps([
      [],
      [calendar("winner@example.com"), calendar("created@example.com")],
    ]);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).resolves.toEqual({
      status: "ready",
      calendarId: "winner@example.com",
      extraRunwayCalendars: 1,
    });
    expect(deps.createCalendar).toHaveBeenCalledOnce();
    expect(deps.listCalendars).toHaveBeenCalledTimes(2);
    expect(database.writes).toEqual([]);
    expect(database.getRow().runway_calendar_id).toBe("winner@example.com");
  });

  it("stores nothing and rethrows when creation fails", async () => {
    const database = makeDatabase({
      runway_calendar_id: null,
      status: "connected",
    });
    const deps = makeDeps([[]]);
    const creationError = new Error("creation failed");
    deps.createCalendar.mockRejectedValueOnce(creationError);

    await expect(
      ensureRunwayCalendar(database.client, "test-user", deps),
    ).rejects.toBe(creationError);
    expect(database.updateCalls).toEqual([]);
    expect(database.writes).toEqual([]);
  });

  it("requires reconnect before making any Google call", async () => {
    const database = makeDatabase({
      runway_calendar_id: null,
      status: "needs_reconnect",
    });
    const deps = makeDeps([[]]);

    await expectGoogleAuthError(
      ensureRunwayCalendar(database.client, "test-user", deps),
      "needs_reconnect",
    );
    expect(deps.getAccessToken).not.toHaveBeenCalled();
    expect(deps.listCalendars).not.toHaveBeenCalled();
    expect(deps.createCalendar).not.toHaveBeenCalled();
  });
});
