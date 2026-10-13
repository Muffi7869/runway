import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));

import { createMorningHandler } from "../../../../lib/cron/handlers";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe("morning cron route", () => {
  it("returns 401 before touching any dependency", async () => {
    process.env.CRON_SECRET = "test-secret";
    const createServiceClient = vi.fn(
      () => ({} as SupabaseClient<Database>),
    );
    const resolveOwnerId = vi.fn(async () => "owner");
    const runMorning = vi.fn();
    const response = await createMorningHandler({
      createServiceClient,
      resolveOwnerId,
      runMorning,
      now: () => new Date("2026-10-12T15:00:00.000Z"),
    })(new Request("https://example.com/api/cron/morning"));

    expect(response.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(resolveOwnerId).not.toHaveBeenCalled();
    expect(runMorning).not.toHaveBeenCalled();
  });
});
