import { describe, expect, it, vi } from "vitest";

import { GOOGLE_CALENDAR_SCOPES } from "./scopes";
import {
  buildAuthUrl,
  sameGoogleAccount,
  statesMatch,
  verifyGoogleAccount,
} from "./oauth";

describe("Google OAuth helpers", () => {
  it("builds the authorization URL with exactly the required parameters", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "test-client-id",
        redirectUri: "https://example.com/api/google/callback",
        state: "test-state",
        loginHint: " owner@example.com ",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/google/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      GOOGLE_CALENDAR_SCOPES,
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("login_hint")).toBe("owner@example.com");
    expect(url.searchParams.has("include_granted_scopes")).toBe(false);
  });

  it.each([undefined, "", "   "])(
    "omits an absent login hint: %s",
    (loginHint) => {
      const url = new URL(
        buildAuthUrl({
          clientId: "test-client-id",
          redirectUri: "https://example.com/api/google/callback",
          state: "test-state",
          loginHint,
        }),
      );

      expect(url.searchParams.has("login_hint")).toBe(false);
    },
  );

  it("compares matching states in constant time", () => {
    expect(statesMatch("same-state", "same-state")).toBe(true);
    expect(statesMatch("first-state", "other-state")).toBe(false);
    expect(statesMatch("short", "longer")).toBe(false);
    expect(statesMatch(undefined, "state")).toBe(false);
    expect(statesMatch("state", null)).toBe(false);
  });

  it("compares Google accounts without alias normalization", () => {
    expect(sameGoogleAccount("owner@example.com", "owner@example.com")).toBe(
      true,
    );
    expect(sameGoogleAccount("OWNER@example.com", "owner@EXAMPLE.com")).toBe(
      true,
    );
    expect(
      sameGoogleAccount(" owner@example.com ", " owner@example.com "),
    ).toBe(true);
    expect(sameGoogleAccount("owner@example.com", "other@example.com")).toBe(
      false,
    );
  });

  it.each([
    [undefined, "owner@example.com"],
    [null, "owner@example.com"],
    ["", "owner@example.com"],
    ["   ", "owner@example.com"],
    ["owner@example.com", undefined],
    ["owner@example.com", null],
    ["owner@example.com", ""],
    ["owner@example.com", "   "],
  ])("rejects missing or blank account values", (email, calendarId) => {
    expect(sameGoogleAccount(email, calendarId)).toBe(false);
  });
});

describe("verifyGoogleAccount", () => {
  function response(body: unknown, status = 200) {
    return vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  it.each([
    ["owner@example.com", "owner@example.com"],
    ["OWNER@example.com", "owner@EXAMPLE.com"],
  ])("accepts the signed-in account", async (signedInEmail, id) => {
    const fetchImpl = response({ id });

    await expect(
      verifyGoogleAccount({
        accessToken: "test-access-token",
        signedInEmail,
        fetchImpl,
      }),
    ).resolves.toBe("match");

    const [requestUrl, init] = (
      fetchImpl.mock.calls as unknown as Array<
        [URL, RequestInit | undefined]
      >
    )[0];
    expect(String(requestUrl)).toContain("fields=id");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-access-token",
    });
  });

  it("rejects a different account", async () => {
    await expect(
      verifyGoogleAccount({
        accessToken: "test-access-token",
        signedInEmail: "owner@example.com",
        fetchImpl: response({ id: "other@example.com" }),
      }),
    ).resolves.toBe("mismatch");
  });

  it.each([
    ["a forbidden response", response({}, 403)],
    ["a missing id", response({})],
    [
      "a network failure",
      vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    ],
  ])("returns unverified for %s", async (_case, fetchImpl) => {
    await expect(
      verifyGoogleAccount({
        accessToken: "test-access-token",
        signedInEmail: "owner@example.com",
        fetchImpl,
      }),
    ).resolves.toBe("unverified");
  });
});
