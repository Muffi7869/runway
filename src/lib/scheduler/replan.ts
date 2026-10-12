import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/db/database.types";
import { mirrorBlocks } from "@/lib/google/block-mirror";
import { syncFixedEvents } from "@/lib/google/sync-service";
import { parseTimeOfDay } from "@/lib/settings/schema";
import { syncWindow } from "@/lib/time/zoned";

import { planSchedule } from "./plan";
import type { ScheduleAssignment, ScheduleInput } from "./types";

const STALE_AFTER_MS = 30 * 60 * 1000;
const planningByOwner: Record<string, Promise<ReplanResult> | undefined> =
  Object.create(null) as Record<string, Promise<ReplanResult> | undefined>;

export type ReplanResult =
  | {
      ok: true;
      planned: number;
      warnings: number;
      syncFailed: boolean;
      mirrorFailed: boolean;
      mirrorNeedsReconnect: boolean;
    }
  | { ok: false; error: string };

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function performReplan(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  now: Date,
): Promise<ReplanResult> {
  const { data: connection, error: connectionError } = await supabase
    .from("google_connection")
    .select("status,last_synced_at")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (connectionError) {
    return { ok: false, error: "Couldn't load planning data. Try again." };
  }

  const lastSync = connection?.last_synced_at
    ? Date.parse(connection.last_synced_at)
    : Number.NaN;
  const syncIsStale =
    !Number.isFinite(lastSync) || now.getTime() - lastSync > STALE_AFTER_MS;
  let syncFailed = false;

  if (connection?.status === "connected" && syncIsStale) {
    const syncResult = await syncFixedEvents({
      supabase,
      userId: ownerId,
      now,
    });
    syncFailed = !syncResult.ok;
  }

  const window = syncWindow(now);
  const [
    settingsResult,
    classesResult,
    fixedEventsResult,
    blockedDaysResult,
    assignmentsResult,
    stepsResult,
    busyBlocksResult,
  ] = await Promise.all([
    supabase
      .from("settings")
      .select(
        "study_window_start,study_window_end,max_study_minutes_per_day,min_block_minutes,max_block_minutes,buffer_days",
      )
      .eq("user_id", ownerId)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id,name,color,pace_ratio")
      .eq("user_id", ownerId),
    supabase
      .from("fixed_events")
      .select("start,end")
      .eq("user_id", ownerId)
      .lt("start", window.timeMax.toISOString())
      .gt("end", window.timeMin.toISOString()),
    supabase
      .from("blocked_days")
      .select("date")
      .eq("user_id", ownerId)
      .gte("date", dateKey(window.timeMin))
      .lt("date", dateKey(window.timeMax)),
    supabase
      .from("assignments")
      .select("id,class_id,title,deadline,weight")
      .eq("user_id", ownerId)
      .eq("status", "active"),
    supabase
      .from("steps")
      .select("id,assignment_id,name,order,estimated_minutes,percent_done")
      .eq("user_id", ownerId)
      .order("order", { ascending: true }),
    supabase
      .from("blocks")
      .select("start,end,status")
      .eq("user_id", ownerId)
      .gt("end", window.timeMin.toISOString())
      .lt("start", window.timeMax.toISOString())
      .or(`status.eq.checked_in,start.lt.${now.toISOString()}`),
  ]);

  if (
    settingsResult.error ||
    classesResult.error ||
    fixedEventsResult.error ||
    blockedDaysResult.error ||
    assignmentsResult.error ||
    stepsResult.error ||
    busyBlocksResult.error ||
    !settingsResult.data
  ) {
    return { ok: false, error: "Couldn't load planning data. Try again." };
  }

  const startMinutes = parseTimeOfDay(settingsResult.data.study_window_start);
  const endMinutes = parseTimeOfDay(settingsResult.data.study_window_end);

  if (startMinutes === null || endMinutes === null) {
    return { ok: false, error: "Couldn't read the study window. Try again." };
  }

  const classesById = new Map(
    classesResult.data.map((classRow) => [classRow.id, classRow]),
  );
  const stepsByAssignment = new Map<
    string,
    ScheduleAssignment["steps"]
  >();

  for (const step of stepsResult.data) {
    const assignmentSteps = stepsByAssignment.get(step.assignment_id) ?? [];
    assignmentSteps.push({
      id: step.id,
      name: step.name,
      order: step.order,
      estimatedMinutes: step.estimated_minutes,
      percentDone: step.percent_done,
    });
    stepsByAssignment.set(step.assignment_id, assignmentSteps);
  }

  const assignments: ScheduleAssignment[] = assignmentsResult.data.flatMap(
    (assignment) => {
      const classRow = classesById.get(assignment.class_id);

      if (
        !classRow ||
        !["low", "medium", "high"].includes(assignment.weight)
      ) {
        return [];
      }

      return [
        {
          id: assignment.id,
          deadline: new Date(assignment.deadline),
          weight: assignment.weight as ScheduleAssignment["weight"],
          paceRatio: classRow.pace_ratio,
          className: classRow.name,
          title: assignment.title,
          steps: stepsByAssignment.get(assignment.id) ?? [],
        },
      ];
    },
  );
  const input: ScheduleInput = {
    now,
    settings: {
      ...settingsResult.data,
      study_window_start: startMinutes,
      study_window_end: endMinutes,
    },
    fixedEvents: fixedEventsResult.data.map((event) => ({
      start: new Date(event.start),
      end: new Date(event.end),
    })),
    blockedDays: blockedDaysResult.data.map((day) => day.date),
    busyBlocks: busyBlocksResult.data.map((block) => ({
      start: new Date(block.start),
      end: new Date(block.end),
    })),
    assignments,
    horizonEnd: window.timeMax,
  };
  const plan = planSchedule(input);
  const blockPayload: Json = plan.blocks.map((block) => ({
    step_id: block.stepId,
    start: block.start.toISOString(),
    end: block.end.toISOString(),
    planned_minutes: block.minutes,
  }));
  const { error: replaceError } = await supabase.rpc(
    "replace_planned_blocks",
    {
      p_now: now.toISOString(),
      p_blocks: blockPayload,
    },
  );

  if (replaceError) {
    return { ok: false, error: "Couldn't save the new plan. Try again." };
  }

  const warnings: Json = plan.warnings.map((warning) => ({
    assignmentId: warning.assignmentId,
    minutesShort: warning.minutesShort,
    firstOverflowDay: warning.firstOverflowDay,
  }));
  const { error: metadataError } = await supabase
    .from("settings")
    .update({
      last_plan_warnings: warnings,
      last_planned_at: now.toISOString(),
    })
    .eq("user_id", ownerId);

  if (metadataError) {
    return { ok: false, error: "Couldn't save planning details. Try again." };
  }

  let mirrorFailed = false;
  let mirrorNeedsReconnect = false;

  try {
    const mirrorResult = await mirrorBlocks(supabase, ownerId);
    mirrorNeedsReconnect = !mirrorResult.ok;
    mirrorFailed = mirrorResult.ok && mirrorResult.failed > 0;
  } catch {
    mirrorFailed = true;
  }

  return {
    ok: true,
    planned: plan.blocks.length,
    warnings: plan.warnings.length,
    syncFailed,
    mirrorFailed,
    mirrorNeedsReconnect,
  };
}

export function replan(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  now = new Date(),
): Promise<ReplanResult> {
  const active = planningByOwner[ownerId];

  if (active) {
    return active;
  }

  const planning = performReplan(supabase, ownerId, now).finally(() => {
    if (planningByOwner[ownerId] === planning) {
      planningByOwner[ownerId] = undefined;
    }
  });
  planningByOwner[ownerId] = planning;
  return planning;
}

export async function replanQuietly(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<void> {
  try {
    await replan(supabase, ownerId);
  } catch {
    // Replanning is best effort after a successful primary action.
  }
}
