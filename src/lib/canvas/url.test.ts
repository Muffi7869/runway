import { describe, expect, it } from "vitest";

import { validateCanvasFeedUrl } from "./url";

const validPath = "/feeds/calendars/user_FAKE.ics";

describe("validateCanvasFeedUrl", () => {
  it.each([
    `https://canvas.ucsd.edu${validPath}`,
    `https://ucsd.instructure.com${validPath}`,
  ])("accepts the allowed feed URL %s", (url) => {
    expect(validateCanvasFeedUrl(url)).toEqual({ ok: true, url });
  });

  it.each([
    "",
    "not a URL",
    `http://canvas.ucsd.edu${validPath}`,
    `https://example.com${validPath}`,
    `https://canvas.ucsd.edu.evil.example${validPath}`,
    `https://evilcanvas.ucsd.edu${validPath}`,
    "https://canvas.ucsd.edu/calendar",
    `https://user@canvas.ucsd.edu${validPath}`,
    `https://canvas.ucsd.edu:444${validPath}`,
  ])("rejects %j without echoing it", (url) => {
    const result = validateCanvasFeedUrl(url);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected URL validation to fail.");
    expect(result.error).not.toContain(url || "undefined");
    expect(result.error).not.toContain("undefined");
  });
});
