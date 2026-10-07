"use server";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import {
  syncFixedEvents,
  type SyncFixedEventsResult,
} from "@/lib/google/sync-service";

export async function syncNowAction(): Promise<SyncFixedEventsResult> {
  const user = await requireOwner();
  const supabase = await createClient();

  return syncFixedEvents({ supabase, userId: user.id, now: new Date() });
}
