import { createReminderHandler } from "../../../../lib/cron/handlers";
import { resolveOwnerId } from "../../../../lib/cron/owner";
import {
  countTodayBlocks,
  sendReminderEmail,
} from "../../../../lib/cron/reminder";
import { createServiceClient } from "../../../../lib/db/service-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = createReminderHandler({
  createServiceClient,
  resolveOwnerId,
  countTodayBlocks,
  sendReminderEmail,
  now: () => new Date(),
});
