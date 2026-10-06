import { describe, expect, it } from "vitest";

import { isOwner } from "./owner";

describe("isOwner", () => {
  it("allows a matching email", () => {
    expect(isOwner("owner@example.com", "owner@example.com")).toBe(true);
  });

  it("denies a different email", () => {
    expect(isOwner("other@example.com", "owner@example.com")).toBe(false);
  });

  it("matches different capitalization", () => {
    expect(isOwner("Owner@Example.com", "owner@example.com")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isOwner("  owner@example.com  ", "\towner@example.com\n")).toBe(
      true,
    );
  });

  it.each([null, undefined, ""])("denies a missing email: %s", (email) => {
    expect(isOwner(email, "owner@example.com")).toBe(false);
  });

  it.each([null, undefined, "", "   "])(
    "denies when the allowed email is missing: %s",
    (allowedEmail) => {
      expect(isOwner("owner@example.com", allowedEmail)).toBe(false);
    },
  );
});
