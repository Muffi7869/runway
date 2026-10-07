import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptToken, encryptToken } from "./tokens";

const KEY_VARIABLE = "TOKEN_ENCRYPTION_KEY";
const originalKey = process.env[KEY_VARIABLE];

function newTestKey() {
  return randomBytes(32).toString("base64");
}

function changePayloadPart(payload: string, index: number): string {
  const parts = payload.split(".");
  const original = parts[index];
  const replacement = original.startsWith("A") ? "B" : "A";
  parts[index] = `${replacement}${original.slice(1)}`;
  return parts.join(".");
}

function getErrorMessage(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("Expected the action to fail.");
}

beforeEach(() => {
  process.env[KEY_VARIABLE] = newTestKey();
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env[KEY_VARIABLE];
  } else {
    process.env[KEY_VARIABLE] = originalKey;
  }
});

describe("token encryption", () => {
  it.each([
    "short-token",
    "Unicode token: café 🚀 你好",
    "long-token-".repeat(1_000),
  ])("round trips a token", (plaintext) => {
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
  });

  it("uses a fresh IV for every encryption", () => {
    const plaintext = "same-token";

    expect(encryptToken(plaintext)).not.toBe(encryptToken(plaintext));
  });

  it.each([
    ["ciphertext", 3],
    ["authentication tag", 2],
    ["IV", 1],
  ] as const)("rejects a tampered %s", (_name, index) => {
    const payload = encryptToken("tamper-test-token");

    expect(() => decryptToken(changePayloadPart(payload, index))).toThrow(
      "Unable to decrypt token.",
    );
  });

  it("rejects decryption with a different key", () => {
    const payload = encryptToken("wrong-key-test-token");
    process.env[KEY_VARIABLE] = newTestKey();

    expect(() => decryptToken(payload)).toThrow("Unable to decrypt token.");
  });

  it("rejects a missing encryption key", () => {
    const plaintext = "missing-key-test-token";
    delete process.env[KEY_VARIABLE];
    const message = getErrorMessage(() => encryptToken(plaintext));

    expect(message).toBe("TOKEN_ENCRYPTION_KEY is required.");
    expect(message).not.toContain(plaintext);
  });

  it("rejects an encryption key with the wrong decoded length", () => {
    const plaintext = "wrong-length-key-test-token";
    const invalidKey = randomBytes(31).toString("base64");
    process.env[KEY_VARIABLE] = invalidKey;
    const message = getErrorMessage(() => encryptToken(plaintext));

    expect(message).toBe(
      "TOKEN_ENCRYPTION_KEY must be base64 that decodes to exactly 32 bytes.",
    );
    expect(message).not.toContain(plaintext);
    expect(message).not.toContain(invalidKey);
  });

  it.each([
    "not-a-payload",
    "v2.a.b.c",
    "v1.invalid!.tag.ciphertext",
  ])("rejects a malformed payload", (payload) => {
    expect(() => decryptToken(payload)).toThrow("Unable to decrypt token.");
  });

  it("does not expose the plaintext or key in decryption errors", () => {
    const plaintext = "private-test-token";
    const payload = encryptToken(plaintext);
    const wrongKey = newTestKey();
    process.env[KEY_VARIABLE] = wrongKey;

    const message = getErrorMessage(() => decryptToken(payload));

    expect(message).toBe("Unable to decrypt token.");
    expect(message).not.toContain(plaintext);
    expect(message).not.toContain(wrongKey);
  });
});
