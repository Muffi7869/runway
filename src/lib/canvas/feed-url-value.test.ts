import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptToken, encryptToken } from "../crypto/tokens";
import { prepareCanvasFeedUrlForStorage } from "./feed-url-value";

const KEY_VARIABLE = "TOKEN_ENCRYPTION_KEY";
const originalKey = process.env[KEY_VARIABLE];
const fakeUrl =
  "https://canvas.ucsd.edu/feeds/calendars/user_FAKE.ics";

beforeEach(() => {
  process.env[KEY_VARIABLE] = randomBytes(32).toString("base64");
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env[KEY_VARIABLE];
  } else {
    process.env[KEY_VARIABLE] = originalKey;
  }
});

describe("prepareCanvasFeedUrlForStorage", () => {
  it("encrypts a valid Canvas feed URL without storing plaintext", () => {
    const result = prepareCanvasFeedUrlForStorage(fakeUrl, encryptToken);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected the fake URL to be valid.");
    expect(result.encryptedValue).not.toBe(fakeUrl);
    expect(result.encryptedValue).not.toContain(fakeUrl);
    expect(decryptToken(result.encryptedValue)).toBe(fakeUrl);
  });

  it("rejects a disallowed URL without encrypting or echoing it", () => {
    const disallowedUrl =
      "https://canvas.ucsd.edu.evil.example/feeds/calendars/private.ics";
    const encrypt = vi.fn((value: string) => value);
    const result = prepareCanvasFeedUrlForStorage(disallowedUrl, encrypt);

    expect(result).toEqual({
      ok: false,
      error:
        "That link isn't a Canvas calendar feed. Copy it from Canvas under Calendar, Calendar Feed.",
    });
    expect(encrypt).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(disallowedUrl);
  });
});
