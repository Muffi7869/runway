export const ALLOWED_CANVAS_HOSTS = [
  "canvas.ucsd.edu",
  "ucsd.instructure.com",
] as const;

export const CANVAS_FEED_PATH_PREFIX = "/feeds/calendars/";

const EMPTY_URL_ERROR = "Enter your Canvas calendar feed link.";
const INVALID_URL_ERROR =
  "That link isn't a Canvas calendar feed. Copy it from Canvas under Calendar, Calendar Feed.";

export type CanvasFeedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function validateCanvasFeedUrl(raw: string): CanvasFeedUrlResult {
  const value = raw.trim();

  if (!value) {
    return { ok: false, error: EMPTY_URL_ERROR };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: INVALID_URL_ERROR };
  }

  const allowed =
    url.protocol === "https:" &&
    ALLOWED_CANVAS_HOSTS.includes(
      url.hostname as (typeof ALLOWED_CANVAS_HOSTS)[number],
    ) &&
    url.pathname.startsWith(CANVAS_FEED_PATH_PREFIX) &&
    !url.username &&
    !url.password &&
    !url.port;

  return allowed
    ? { ok: true, url: url.toString() }
    : { ok: false, error: INVALID_URL_ERROR };
}
