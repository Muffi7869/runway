import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchCanvasFeed } from "./fetch";

const feedUrl =
  "https://canvas.ucsd.edu/feeds/calendars/user_FAKE.ics";

function mockFetch(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe("fetchCanvasFeed", () => {
  it("returns text from a successful response with manual redirects", async () => {
    const fetchImpl = mockFetch(new Response("BEGIN:VCALENDAR", { status: 200 }));

    await expect(fetchCanvasFeed(feedUrl, fetchImpl)).resolves.toEqual({
      ok: true,
      text: "BEGIN:VCALENDAR",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      feedUrl,
      expect.objectContaining({
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([302, 500])("returns a generic error for status %i", async (status) => {
    const response = new Response("not used", {
      status,
      headers: status === 302 ? { location: "https://example.com" } : {},
    });
    const result = await fetchCanvasFeed(feedUrl, mockFetch(response));

    expect(result).toEqual({
      ok: false,
      error: "Couldn't reach Canvas. Check the link in Settings and try again.",
    });
    expect(JSON.stringify(result)).not.toContain(feedUrl);
  });

  it("returns a generic error when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`private network error for ${feedUrl}`);
    }) as unknown as typeof fetch;
    const result = await fetchCanvasFeed(feedUrl, fetchImpl);

    expect(result).toEqual({
      ok: false,
      error: "Couldn't reach Canvas. Check the link in Settings and try again.",
    });
    expect(JSON.stringify(result)).not.toContain(feedUrl);
  });

  it("cancels an oversized streamed body before reading the remaining chunk", async () => {
    const chunks = [
      new Uint8Array(1_100_000),
      new Uint8Array(1_100_000),
      new Uint8Array(10),
    ];
    let readIndex = 0;
    const read = vi.fn(async () => ({
      done: false,
      value: chunks[readIndex++],
    }));
    const cancel = vi.fn(async () => undefined);
    const response = {
      ok: true,
      status: 200,
      body: { getReader: () => ({ read, cancel }) },
    } as unknown as Response;

    await expect(fetchCanvasFeed(feedUrl, mockFetch(response))).resolves.toEqual({
      ok: false,
      error: "That calendar feed is too large.",
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledTimes(2);
    expect(readIndex).toBeLessThan(chunks.length);
  });

  it("does not call fetch for a disallowed URL", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const privateUrl =
      "https://canvas.ucsd.edu.evil.example/feeds/calendars/private.ics";
    const result = await fetchCanvasFeed(privateUrl, fetchImpl);

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(privateUrl);
  });
});
