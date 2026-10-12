import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptToken } from "../crypto/tokens";
import type { Database } from "../db/database.types";

export type CanvasFeedUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_set" | "unreadable" };

// Callers must run requireOwner() before calling this helper.
export async function getCanvasFeedUrl(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CanvasFeedUrlResult> {
  const { data, error } = await supabase
    .from("settings")
    .select("canvas_feed_url_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "unreadable" };
  }

  if (!data?.canvas_feed_url_encrypted) {
    return { ok: false, reason: "not_set" };
  }

  try {
    return { ok: true, url: decryptToken(data.canvas_feed_url_encrypted) };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
