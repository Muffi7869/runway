import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));

import {
  buildReminderMessage,
  countTodayBlocks,
  sendReminderEmail,
} from "./reminder";

const originalEnvironment = {
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("reminder delivery", () => {
  it("builds singular and plural count-only messages", () => {
    process.env.APP_URL = "https://example.com";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(buildReminderMessage(1)).toMatchObject({
      subject: "Check in for today",
      text: "You have 1 block planned today.\n\nhttps://example.com/checkin",
    });
    expect(buildReminderMessage(2).text).toContain(
      "You have 2 blocks planned today.",
    );
  });

  it("counts only planned and checked-in owner blocks in today's bounds", async () => {
    const filters: Array<[string, unknown]> = [];
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      in(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      gte(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      async lt(column: string, value: unknown) {
        filters.push([column, value]);
        return { count: 2, error: null };
      },
    };
    const service = {
      from: vi.fn(() => ({ select: vi.fn(() => builder) })),
    } as unknown as SupabaseClient<Database>;
    const start = new Date("2026-10-12T07:00:00.000Z");
    const end = new Date("2026-10-13T07:00:00.000Z");

    await expect(countTodayBlocks(service, "owner", start, end)).resolves.toBe(2);
    expect(filters).toEqual([
      ["user_id", "owner"],
      ["status", ["planned", "checked_in"]],
      ["start", start.toISOString()],
      ["start", end.toISOString()],
    ]);
  });

  it("sends only the count and check-in link in the email content", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    process.env.APP_URL = "https://example.com";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.RESEND_FROM = "Runway <sender@example.com>";
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 200 }),
    );

    await sendReminderEmail(3, fetchImpl);

    const options = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(options.body)) as Record<string, string>;
    expect(body).toEqual({
      from: "Runway <sender@example.com>",
      to: "owner@example.com",
      subject: "Check in for today",
      text: "You have 3 blocks planned today.\n\nhttps://example.com/checkin",
      html: '<p>You have 3 blocks planned today.</p><p><a href="https://example.com/checkin">Open check-in</a></p>',
    });
    expect(body.text).not.toMatch(/class|assignment|step/i);
    expect(body.html).not.toMatch(/class|assignment|step/i);
    expect(body.text).not.toContain("owner@example.com");
    expect(body.html).not.toContain("owner@example.com");
  });

  it("turns a Resend rejection into a generic error", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    process.env.RESEND_API_KEY = "test-api-key";
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 500 }),
    );

    await expect(sendReminderEmail(2, fetchImpl)).rejects.toThrow(
      "Reminder delivery failed.",
    );
  });
});
