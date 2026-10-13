import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));

import { resolveOwnerId } from "./owner";

const originalAllowedEmail = process.env.ALLOWED_EMAIL;

afterEach(() => {
  if (originalAllowedEmail === undefined) {
    delete process.env.ALLOWED_EMAIL;
  } else {
    process.env.ALLOWED_EMAIL = originalAllowedEmail;
  }
});

function serviceWithPages(
  pages: Array<Array<{ id: string; email?: string }>>,
): SupabaseClient<Database> {
  const listUsers = vi.fn(async ({ page }: { page: number }) => ({
    data: {
      users: pages[page - 1] ?? [],
      nextPage: page < pages.length ? page + 1 : null,
      lastPage: pages.length,
      total: pages.flat().length,
    },
    error: null,
  }));

  return {
    auth: { admin: { listUsers } },
  } as unknown as SupabaseClient<Database>;
}

describe("resolveOwnerId", () => {
  it("returns the one matching user across pages", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    const service = serviceWithPages([
      [{ id: "other", email: "other@example.com" }],
      [{ id: "owner", email: "owner@example.com" }],
    ]);

    await expect(resolveOwnerId(service)).resolves.toBe("owner");
  });

  it("matches email case-insensitively", async () => {
    process.env.ALLOWED_EMAIL = "OWNER@example.com";
    const service = serviceWithPages([
      [{ id: "owner", email: "owner@EXAMPLE.com" }],
    ]);

    await expect(resolveOwnerId(service)).resolves.toBe("owner");
  });

  it("rejects zero matches with a generic error", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    const service = serviceWithPages([
      [{ id: "other", email: "other@example.com" }],
    ]);

    await expect(resolveOwnerId(service)).rejects.toThrow(
      "Owner account lookup failed.",
    );
  });

  it("rejects two matches with a generic error", async () => {
    process.env.ALLOWED_EMAIL = "owner@example.com";
    const service = serviceWithPages([[
      { id: "first", email: "owner@example.com" },
      { id: "second", email: "OWNER@example.com" },
    ]]);

    await expect(resolveOwnerId(service)).rejects.toThrow(
      "Owner account lookup failed.",
    );
  });
});
