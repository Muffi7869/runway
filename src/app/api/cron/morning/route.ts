import { createMorningHandler } from "../../../../lib/cron/handlers";
import { runMorning } from "../../../../lib/cron/morning";
import { resolveOwnerId } from "../../../../lib/cron/owner";
import { createServiceClient } from "../../../../lib/db/service-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = createMorningHandler({
  createServiceClient,
  resolveOwnerId,
  runMorning,
  now: () => new Date(),
});
