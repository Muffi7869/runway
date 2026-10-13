import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));

import { createReminderHandler } from "../../../../lib/cron/handlers";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

function authorizedRequest(): Request {
  return new Request("https://example.com/api/cron/reminder", {
    headers: { authorization: "Bearer test-secret" },
  });
}

function baseDependencies() {
  const service = {} as SupabaseClient<Database>;
  return {
    createServiceClient: vi.fn(() => service),
    resolveOwnerId: vi.fn(async () => "owner"),
    countTodayBlocks: vi.fn(async () => 2),
    sendReminderEmail: vi.fn(async () => undefined),
    now: () => new Date("2026-10-12T20:00:00.000Z"),
  };
}

describe("reminder cron route", () => {
  it("returns 401 before touching any dependency", async () => {
    process.env.CRON_SECRET = "test-secret";
    const dependencies = baseDependencies();
    const response = await createReminderHandler(dependencies)(
      new Request("https://example.com/api/cron/reminder"),
    );

    expect(response.status).toBe(401);
    expect(dependencies.createServiceClient).not.toHaveBeenCalled();
    expect(dependencies.resolveOwnerId).not.toHaveBeenCalled();
    expect(dependencies.countTodayBlocks).not.toHaveBeenCalled();
    expect(dependencies.sendReminderEmail).not.toHaveBeenCalled();
  });

  it("skips delivery when there are no blocks", async () => {
    process.env.CRON_SECRET = "test-secret";
    const dependencies = baseDependencies();
    dependencies.countTodayBlocks.mockResolvedValue(0);
    const response = await createReminderHandler(dependencies)(
      authorizedRequest(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sent: false });
    expect(dependencies.sendReminderEmail).not.toHaveBeenCalled();
  });

  it("sends one reminder with the block count", async () => {
    process.env.CRON_SECRET = "test-secret";
    const dependencies = baseDependencies();
    const response = await createReminderHandler(dependencies)(
      authorizedRequest(),
    );

    expect(response.status).toBe(200);
    expect(dependencies.sendReminderEmail).toHaveBeenCalledWith(2);
    await expect(response.json()).resolves.toEqual({ sent: true, blocks: 2 });
  });

  it("returns a generic 500 when Resend fails", async () => {
    process.env.CRON_SECRET = "test-secret";
    const dependencies = baseDependencies();
    dependencies.sendReminderEmail.mockRejectedValue(new Error("private"));
    const response = await createReminderHandler(dependencies)(
      authorizedRequest(),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Reminder job failed.",
    });
  });
});
