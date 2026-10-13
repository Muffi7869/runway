import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "../db/database.types";
import { verifyCronRequest } from "./auth";
import type { runMorning } from "./morning";
import type { resolveOwnerId } from "./owner";
import type {
  countTodayBlocks,
  sendReminderEmail,
} from "./reminder";
import { missedCutoff, todayBounds } from "./time";

export type ReminderRouteDependencies = {
  createServiceClient: () => SupabaseClient<Database>;
  resolveOwnerId: typeof resolveOwnerId;
  countTodayBlocks: typeof countTodayBlocks;
  sendReminderEmail: typeof sendReminderEmail;
  now: () => Date;
};

export function createReminderHandler(
  dependencies: ReminderRouteDependencies,
) {
  return async function reminderHandler(request: Request): Promise<Response> {
    if (!verifyCronRequest(request)) {
      return new Response(null, { status: 401 });
    }

    try {
      const service = dependencies.createServiceClient();
      const ownerId = await dependencies.resolveOwnerId(service);
      const { start, end } = todayBounds(dependencies.now());
      const count = await dependencies.countTodayBlocks(
        service,
        ownerId,
        start,
        end,
      );

      if (count === 0) {
        return NextResponse.json({ sent: false });
      }

      await dependencies.sendReminderEmail(count);
      return NextResponse.json({ sent: true, blocks: count });
    } catch {
      return NextResponse.json(
        { error: "Reminder job failed." },
        { status: 500 },
      );
    }
  };
}

export type MorningRouteDependencies = {
  createServiceClient: () => SupabaseClient<Database>;
  resolveOwnerId: typeof resolveOwnerId;
  runMorning: typeof runMorning;
  now: () => Date;
};

export function createMorningHandler(dependencies: MorningRouteDependencies) {
  return async function morningHandler(request: Request): Promise<Response> {
    if (!verifyCronRequest(request)) {
      return new Response(null, { status: 401 });
    }

    try {
      const service = dependencies.createServiceClient();
      const ownerId = await dependencies.resolveOwnerId(service);
      const now = dependencies.now();
      const result = await dependencies.runMorning(
        service,
        ownerId,
        now,
        missedCutoff(now),
      );

      return NextResponse.json(result);
    } catch {
      return NextResponse.json(
        { error: "Morning job failed." },
        { status: 500 },
      );
    }
  };
}
