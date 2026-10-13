import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";
import { mirrorBlocks } from "../google/block-mirror";
import { replan } from "../scheduler/replan";

export type MorningResult = {
  missed: number;
  missedFailed: boolean;
  replanFailed: boolean;
  mirrorFailed: boolean;
  mirrorNeedsReconnect: boolean;
};

export async function markMissedBlocks(
  service: SupabaseClient<Database>,
  ownerId: string,
  cutoff: Date,
): Promise<number> {
  const { data, error } = await service
    .from("blocks")
    .update({ status: "missed" })
    .eq("user_id", ownerId)
    .eq("status", "planned")
    .lt("end", cutoff.toISOString())
    .select("id");

  if (error) {
    throw new Error("Missed-block update failed.");
  }

  return data.length;
}

type MorningDependencies = {
  markMissedBlocks?: typeof markMissedBlocks;
  replan?: typeof replan;
  mirrorBlocks?: typeof mirrorBlocks;
};

export async function runMorning(
  service: SupabaseClient<Database>,
  ownerId: string,
  now: Date,
  cutoff: Date,
  dependencies: MorningDependencies = {},
): Promise<MorningResult> {
  const markMissed = dependencies.markMissedBlocks ?? markMissedBlocks;
  const plan = dependencies.replan ?? replan;
  const mirror = dependencies.mirrorBlocks ?? mirrorBlocks;
  let missed = 0;
  let missedFailed = false;

  try {
    missed = await markMissed(service, ownerId, cutoff);
  } catch {
    missedFailed = true;
  }

  let replanFailed = false;

  try {
    const result = await plan(service, ownerId, now, { mirror: false });
    replanFailed = !result.ok;
  } catch {
    replanFailed = true;
  }

  let mirrorFailed = false;
  let mirrorNeedsReconnect = false;

  try {
    const result = await mirror(service, ownerId);
    mirrorNeedsReconnect = !result.ok;
    mirrorFailed = result.ok && result.failed > 0;
  } catch {
    mirrorFailed = true;
  }

  return {
    missed,
    missedFailed,
    replanFailed,
    mirrorFailed,
    mirrorNeedsReconnect,
  };
}
