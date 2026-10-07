import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptToken } from "../crypto/tokens";
import type { Database } from "../db/database.types";

import { getGoogleCredentials } from "./request";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleAuthErrorCode =
  | "needs_reconnect"
  | "token_unreadable"
  | "google_unavailable";

export class GoogleAuthError extends Error {
  constructor(public readonly code: GoogleAuthErrorCode) {
    super(code);
    this.name = "GoogleAuthError";
  }
}

async function markNeedsReconnect(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  await supabase
    .from("google_connection")
    .update({ status: "needs_reconnect" })
    .eq("user_id", userId);
}

// Callers must run requireOwner() before calling this helper.
export async function getAccessToken(
  supabase: SupabaseClient<Database>,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const { data, error } = await supabase
    .from("google_connection")
    .select("refresh_token_encrypted, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new GoogleAuthError("google_unavailable");
  }

  if (!data || data.status !== "connected") {
    throw new GoogleAuthError("needs_reconnect");
  }

  let refreshToken: string;

  try {
    refreshToken = decryptToken(data.refresh_token_encrypted);
  } catch {
    await markNeedsReconnect(supabase, userId);
    throw new GoogleAuthError("token_unreadable");
  }

  const { clientId, clientSecret } = getGoogleCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let response: Response;

  try {
    response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new GoogleAuthError("google_unavailable");
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    throw new GoogleAuthError("google_unavailable");
  }

  const tokenResult =
    typeof result === "object" && result !== null
      ? (result as { access_token?: unknown; error?: unknown })
      : {};

  if (!response.ok) {
    if (tokenResult.error === "invalid_grant") {
      await markNeedsReconnect(supabase, userId);
      throw new GoogleAuthError("needs_reconnect");
    }

    throw new GoogleAuthError("google_unavailable");
  }

  if (typeof tokenResult.access_token !== "string") {
    throw new GoogleAuthError("google_unavailable");
  }

  return tokenResult.access_token;
}
