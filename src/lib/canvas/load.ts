import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";
import { getCanvasFeedUrl } from "./feed-url";
import { fetchCanvasFeed } from "./fetch";
import { parseCanvasFeed, type CanvasSkippedCounts } from "./parse";
import { planImport, type ImportPlan } from "./plan";

const LOAD_ERROR = "Couldn't load Canvas assignments. Try again.";

type CanvasClass = { id: string; name: string };

export type LoadedCanvasPlan = {
  plan: ImportPlan;
  skipped: CanvasSkippedCounts;
  classes: CanvasClass[];
};

export type LoadCanvasPlanResult =
  | { ok: true; value: LoadedCanvasPlan }
  | { ok: false; error: string };

const assignmentStatuses = ["active", "done", "dropped"] as const;

function hasSupportedStatus(
  value: string,
): value is (typeof assignmentStatuses)[number] {
  return assignmentStatuses.includes(
    value as (typeof assignmentStatuses)[number],
  );
}

// Callers must run requireOwner() before calling this helper.
export async function loadCanvasPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<LoadCanvasPlanResult> {
  const savedUrl = await getCanvasFeedUrl(supabase, userId);

  if (!savedUrl.ok) {
    return {
      ok: false,
      error:
        savedUrl.reason === "not_set"
          ? "Add your Canvas calendar link in Settings first."
          : "Couldn't read your saved Canvas link. Re-enter it in Settings.",
    };
  }

  const fetched = await fetchCanvasFeed(savedUrl.url);

  if (!fetched.ok) {
    return fetched;
  }

  const parsed = parseCanvasFeed(fetched.text);

  if (!parsed.ok) {
    return {
      ok: false,
      error: "Canvas sent something Runway couldn't read.",
    };
  }

  const [classesResult, assignmentsResult] = await Promise.all([
    supabase.from("classes").select("id,name").eq("user_id", userId),
    supabase
      .from("assignments")
      .select("id,canvas_uid,deadline,status,title")
      .eq("user_id", userId)
      .not("canvas_uid", "is", null),
  ]);

  if (classesResult.error || assignmentsResult.error) {
    return { ok: false, error: LOAD_ERROR };
  }

  const existing = [];

  for (const assignment of assignmentsResult.data) {
    if (!assignment.canvas_uid || !hasSupportedStatus(assignment.status)) {
      return { ok: false, error: LOAD_ERROR };
    }

    existing.push({
      ...assignment,
      canvas_uid: assignment.canvas_uid,
      status: assignment.status,
    });
  }

  return {
    ok: true,
    value: {
      plan: planImport(parsed.items, existing, classesResult.data, now),
      skipped: parsed.skipped,
      classes: classesResult.data,
    },
  };
}
