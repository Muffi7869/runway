import { describe, expect, it, vi } from "vitest";

import {
  createCalendar,
  GoogleApiError,
  isRunwayCalendarCandidate,
  listCalendars,
  type GoogleCalendar,
} from "./calendar-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function calendar(
  overrides: Partial<GoogleCalendar> = {},
): GoogleCalendar {
  return {
    id: "calendar@example.com",
    name: "Runway",
    summary: "Runway",
    primary: false,
    accessRole: "owner",
    ...overrides,
  };
}

describe("listCalendars", () => {
  it("merges pages, skips deleted entries, and limits request fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "first@example.com",
              summary: "First",
              summaryOverride: "First override",
              primary: true,
              accessRole: "owner",
            },
            {
              id: "deleted@example.com",
              summary: "Deleted",
              accessRole: "owner",
              deleted: true,
            },
          ],
          nextPageToken: "page-two",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "second@example.com",
              summary: "Second",
              primary: false,
              accessRole: "reader",
            },
          ],
        }),
      );

    await expect(
      listCalendars("test-access-token", fetchImpl),
    ).resolves.toEqual([
      {
        id: "first@example.com",
        name: "First override",
        summary: "First",
        primary: true,
        accessRole: "owner",
      },
      {
        id: "second@example.com",
        name: "Second",
        summary: "Second",
        primary: false,
        accessRole: "reader",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    const secondUrl = new URL(String(fetchImpl.mock.calls[1][0]));
    expect(firstUrl.searchParams.get("maxResults")).toBe("250");
    expect(firstUrl.searchParams.get("showHidden")).toBe("true");
    expect(firstUrl.searchParams.get("fields")).toBe(
      "items(id,summary,summaryOverride,primary,accessRole,deleted),nextPageToken",
    );
    expect(firstUrl.searchParams.has("pageToken")).toBe(false);
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-two");
  });

  it("throws a structured error without exposing Google's response body", async () => {
    const privateBody = "private response details";
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            errors: [{ reason: "rateLimitExceeded" }],
            message: privateBody,
          },
        },
        429,
      ),
    );

    try {
      await listCalendars("test-access-token", fetchImpl);
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleApiError);
      expect((error as GoogleApiError).status).toBe(429);
      expect((error as GoogleApiError).reason).toBe("rateLimitExceeded");
      expect((error as Error).message).not.toContain(privateBody);
      expect(JSON.stringify(error)).not.toContain(privateBody);
      return;
    }

    throw new Error("Expected GoogleApiError.");
  });

  it("stops after ten pages", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ items: [], nextPageToken: "another-page" }),
    );

    await expect(
      listCalendars("test-access-token", fetchImpl),
    ).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });
});

describe("createCalendar", () => {
  it("creates a calendar and returns its id", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: "created@example.com" }),
    );

    await expect(
      createCalendar(
        "test-access-token",
        { summary: "Runway", timeZone: "America/Los_Angeles" },
        fetchImpl,
      ),
    ).resolves.toBe("created@example.com");

    const [url, init] = (
      fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>
    )[0];
    expect(url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ summary: "Runway", timeZone: "America/Los_Angeles" }),
    );
  });
});

describe("isRunwayCalendarCandidate", () => {
  it.each([
    ["owned Runway calendar", calendar(), true],
    ["trimmed summary", calendar({ summary: "  Runway  " }), true],
    ["reader role", calendar({ accessRole: "reader" }), false],
    ["writer role", calendar({ accessRole: "writer" }), false],
    ["primary calendar", calendar({ primary: true }), false],
    ["different capitalization", calendar({ summary: "runway" }), false],
    ["different name", calendar({ summary: "Runway 2" }), false],
    [
      "override only",
      calendar({ name: "Runway", summary: "Different" }),
      false,
    ],
  ])("checks %s", (_name, value, expected) => {
    expect(isRunwayCalendarCandidate(value)).toBe(expected);
  });
});
