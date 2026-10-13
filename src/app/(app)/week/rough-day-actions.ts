"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import type { Json } from "@/lib/db/database.types";
import {
  describeRoughDay,
  summarizeRoughDay,
  type RoughDaySnapshot,
  type RoughDayWarning,
} from "@/lib/scheduler/rough-day";
import { replan } from "@/lib/scheduler/replan";
import { laDateKey } from "@/lib/settings/day-off";
import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/time/zoned";
import { buildWarningSentences } from "@/lib/week/presentation";

export type RoughDayActionResult = {
  ok?: boolean;
  error?: string;
  text?: string;
  warnings?: string[];
  note?: string;
};

function dayBounds(now: Date): { start: Date; end: Date } {
  const { year, month, day } = zonedParts(now, APP_TIMEZONE);
  const tomorrow = addDays({ year, month, day }, 1);
  return {
    start: zonedTimeToUtc(
      { year, month, day, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
    end: zonedTimeToUtc(
      { ...tomorrow, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
  };
}

function readWarnings(value: Json | null): RoughDayWarning[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((warning) => {
    if (
      !warning ||
      Array.isArray(warning) ||
      typeof warning !== "object" ||
      typeof warning.assignmentId !== "string" ||
      typeof warning.minutesShort !== "number" ||
      !Number.isInteger(warning.minutesShort) ||
      warning.minutesShort < 0 ||
      typeof warning.firstOverflowDay !== "string"
    ) {
      return [];
    }

    return [{
      assignmentId: warning.assignmentId,
      minutesShort: warning.minutesShort,
      firstOverflowDay: warning.firstOverflowDay,
    }];
  });
}

async function loadSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  now: Date,
): Promise<RoughDaySnapshot> {
  const { start, end } = dayBounds(now);
  const [blocksResult, settingsResult] = await Promise.all([
    supabase
      .from("blocks")
      .select("start,planned_minutes,status")
      .eq("user_id", ownerId)
      .eq("status", "planned")
      .gte("start", start.toISOString())
      .lt("start", end.toISOString()),
    supabase
      .from("settings")
      .select("last_plan_warnings")
      .eq("user_id", ownerId)
      .maybeSingle(),
  ]);

  if (blocksResult.error || settingsResult.error) {
    throw new Error("Unable to read the current plan.");
  }

  return {
    blocks: blocksResult.data.map((block) => ({
      start: block.start,
      minutes: block.planned_minutes,
      status: block.status,
    })),
    warnings: readWarnings(settingsResult.data?.last_plan_warnings ?? null),
  };
}

export async function roughDayAction(): Promise<RoughDayActionResult> {
  const user = await requireOwner();
  const supabase = await createClient();
  const now = new Date();
  const todayLa = laDateKey(now);
  let before: RoughDaySnapshot;

  try {
    before = await loadSnapshot(supabase, user.id, now);
  } catch {
    return { error: "Couldn't read today's plan. Try again." };
  }

  const { error: insertError } = await supabase.from("blocked_days").insert({
    user_id: user.id,
    date: todayLa,
    reason: "rough day",
  });

  if (insertError?.code === "23505") {
    return { error: "Today is already a day off." };
  }

  if (insertError) {
    return { error: "Couldn't save the rough day. Try again." };
  }

  const planResult = await replan(supabase, user.id, now);
  revalidatePath("/week");
  revalidatePath("/settings");

  if (!planResult.ok) {
    return {
      ok: true,
      text: "Day off saved.",
      note: "Day off saved. Replan didn't finish; press Replan.",
      warnings: [],
    };
  }

  try {
    const after = await loadSnapshot(supabase, user.id, now);
    const summary = summarizeRoughDay({ before, after, todayLa });
    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (assignmentsError) {
      throw new Error("Unable to read warnings.");
    }

    return {
      ok: true,
      text: describeRoughDay(summary),
      warnings: buildWarningSentences(
        summary.newWarnings as unknown as Json,
        assignments,
      ),
    };
  } catch {
    return {
      ok: true,
      text: "Day off saved.",
      note: "Day off saved. The change summary couldn't be loaded.",
      warnings: [],
    };
  }
}

export async function undoRoughDayAction(): Promise<RoughDayActionResult> {
  const user = await requireOwner();
  const supabase = await createClient();
  const todayLa = laDateKey(new Date());
  const { data, error } = await supabase
    .from("blocked_days")
    .delete()
    .eq("user_id", user.id)
    .eq("date", todayLa)
    .eq("reason", "rough day")
    .select("id");

  if (error) {
    return { error: "Couldn't undo the rough day. Try again." };
  }

  if (data.length === 0) {
    return { error: "There's no rough day to undo." };
  }

  const planResult = await replan(supabase, user.id);
  revalidatePath("/week");
  revalidatePath("/settings");

  return planResult.ok
    ? { ok: true, text: "Rough day undone.", warnings: [] }
    : {
        ok: true,
        text: "Rough day undone.",
        note: "Rough day removed. Replan didn't finish; press Replan.",
        warnings: [],
      };
}
