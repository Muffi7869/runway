import "server-only";

import { validateCanvasFeedUrl } from "./url";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const FETCH_ERROR = "Couldn't reach Canvas. Check the link in Settings and try again.";
const TOO_LARGE_ERROR = "That calendar feed is too large.";

type FetchCanvasFeedResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

async function readBodyWithLimit(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error("missing response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return text + decoder.decode();
    }

    bytesRead += value.byteLength;

    if (bytesRead > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new RangeError(TOO_LARGE_ERROR);
    }

    text += decoder.decode(value, { stream: true });
  }
}

export async function fetchCanvasFeed(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchCanvasFeedResult> {
  const validated = validateCanvasFeedUrl(rawUrl);

  if (!validated.ok) {
    return validated;
  }

  try {
    const response = await fetchImpl(validated.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });

    if (
      (response.status >= 300 && response.status < 400) ||
      !response.ok
    ) {
      return { ok: false, error: FETCH_ERROR };
    }

    return { ok: true, text: await readBodyWithLimit(response) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof RangeError ? TOO_LARGE_ERROR : FETCH_ERROR,
    };
  }
}
