import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));

import { markMissedBlocks, runMorning } from "./morning";

const NOW = new Date("2026-10-12T15:00:00.000Z");
const CUTOFF = new Date("2026-10-12T07:00:00.000Z");

describe("morning processing", () => {
  it("marks only owner planned blocks ending before the cutoff", async () => {
    const filters: Array<[string, unknown]> = [];
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      lt(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      async select() {
        return { data: [{ id: "block-a" }], error: null };
      },
    };
    const service = {
      from: vi.fn(() => ({ update: vi.fn(() => builder) })),
    } as unknown as SupabaseClient<Database>;

    await expect(markMissedBlocks(service, "owner", CUTOFF)).resolves.toBe(1);
    expect(filters).toEqual([
      ["user_id", "owner"],
      ["status", "planned"],
      ["end", CUTOFF.toISOString()],
    ]);
  });

  it("runs missed update, replan, then mirror in order", async () => {
    const order: string[] = [];
    const service = {} as SupabaseClient<Database>;
    const result = await runMorning(service, "owner", NOW, CUTOFF, {
      markMissedBlocks: vi.fn(async () => {
        order.push("missed");
        return 2;
      }),
      replan: vi.fn(async () => {
        order.push("replan");
        return {
          ok: true as const,
          planned: 3,
          warnings: 0,
          syncFailed: false,
          mirrorFailed: false,
          mirrorNeedsReconnect: false,
        };
      }),
      mirrorBlocks: vi.fn(async () => {
        order.push("mirror");
        return {
          ok: true as const,
          created: 1,
          updated: 0,
          deleted: 0,
          failed: 0,
        };
      }),
    });

    expect(order).toEqual(["missed", "replan", "mirror"]);
    expect(result).toEqual({
      missed: 2,
      missedFailed: false,
      replanFailed: false,
      mirrorFailed: false,
      mirrorNeedsReconnect: false,
    });
  });

  it("continues to mirror after a replan failure", async () => {
    const mirror = vi.fn(async () => ({
      ok: true as const,
      created: 0,
      updated: 0,
      deleted: 0,
      failed: 0,
    }));
    const result = await runMorning(
      {} as SupabaseClient<Database>,
      "owner",
      NOW,
      CUTOFF,
      {
        markMissedBlocks: vi.fn(async () => 0),
        replan: vi.fn(async () => ({
          ok: false as const,
          error: "generic",
        })),
        mirrorBlocks: mirror,
      },
    );

    expect(result.replanFailed).toBe(true);
    expect(mirror).toHaveBeenCalledOnce();
  });
});
