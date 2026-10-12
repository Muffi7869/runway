"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import {
  syncFixedEvents,
  type SyncFixedEventsResult,
} from "@/lib/google/sync-service";
import { replan, type ReplanResult } from "@/lib/scheduler/replan";

export async function syncNowAction(): Promise<SyncFixedEventsResult> {
  const user = await requireOwner();
  const supabase = await createClient();

  return syncFixedEvents({ supabase, userId: user.id, now: new Date() });
}

export async function replanAction(): Promise<ReplanResult> {
  const user = await requireOwner();
  const supabase = await createClient();
  const result = await replan(supabase, user.id);

  revalidatePath("/week");
  revalidatePath("/assignments");
  return result;
}
