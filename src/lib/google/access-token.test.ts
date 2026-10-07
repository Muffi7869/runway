import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encryptToken } from "../crypto/tokens";
import type { Database } from "../db/database.types";

vi.mock("server-only", () => ({}));

import { getAccessToken, GoogleAuthError } from "./access-token";

const ORIGINAL_ENV = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
};

type ConnectionRow = {
  refresh_token_encrypted: string;
  status: string;
};

function makeSupabase(row: ConnectionRow | null) {
  const updates: Array<Record<string, unknown>> = [];
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn((values: Record<string, unknown>) => {
    updates.push(values);
    return { eq: updateEq };
  });
  const from = vi.fn(() => ({ select, update }));

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    updates,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function expectGoogleError(
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

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  const variables = [
    ["GOOGLE_CLIENT_ID", ORIGINAL_ENV.clientId],
    ["GOOGLE_CLIENT_SECRET", ORIGINAL_ENV.clientSecret],
    ["TOKEN_ENCRYPTION_KEY", ORIGINAL_ENV.encryptionKey],
  ] as const;

  for (const [name, value] of variables) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("getAccessToken", () => {
  it("returns an access token without writing anything", async () => {
    const { client, updates } = makeSupabase({
      refresh_token_encrypted: encryptToken("test-refresh-token"),
      status: "connected",
    });
    const fetchImpl = jsonResponse({ access_token: "test-access-token" });

    await expect(getAccessToken(client, "test-user", fetchImpl)).resolves.toBe(
      "test-access-token",
    );
    expect(updates).toEqual([]);
  });

  it("marks the connection for reconnect after invalid_grant", async () => {
    const { client, updates } = makeSupabase({
      refresh_token_encrypted: encryptToken("test-refresh-token"),
      status: "connected",
    });

    await expectGoogleError(
      getAccessToken(
        client,
        "test-user",
        jsonResponse({ error: "invalid_grant" }, 400),
      ),
      "needs_reconnect",
    );
    expect(updates).toEqual([{ status: "needs_reconnect" }]);
  });

  it("leaves status alone after a server failure", async () => {
    const { client, updates } = makeSupabase({
      refresh_token_encrypted: encryptToken("test-refresh-token"),
      status: "connected",
    });

    await expectGoogleError(
      getAccessToken(client, "test-user", jsonResponse({}, 500)),
      "google_unavailable",
    );
    expect(updates).toEqual([]);
  });

  it("marks the connection for reconnect after decryption fails", async () => {
    const { client, updates } = makeSupabase({
      refresh_token_encrypted: "malformed-payload",
      status: "connected",
    });

    await expectGoogleError(
      getAccessToken(client, "test-user", jsonResponse({})),
      "token_unreadable",
    );
    expect(updates).toEqual([{ status: "needs_reconnect" }]);
  });

  it("does not call Google when reconnect is already needed", async () => {
    const { client, updates } = makeSupabase({
      refresh_token_encrypted: "unused",
      status: "needs_reconnect",
    });
    const fetchImpl = jsonResponse({ access_token: "unused" });

    await expectGoogleError(
      getAccessToken(client, "test-user", fetchImpl),
      "needs_reconnect",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});
