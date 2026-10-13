import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";

const PAGE_SIZE = 100;

export async function resolveOwnerId(
  service: SupabaseClient<Database>,
): Promise<string> {
  const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  if (!allowedEmail) {
    throw new Error("Owner account configuration is invalid.");
  }

  const matches: string[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error("Owner account lookup failed.");
    }

    for (const user of data.users) {
      if (user.email?.trim().toLowerCase() === allowedEmail) {
        matches.push(user.id);
      }
    }

    if (matches.length > 1 || data.nextPage === null) {
      break;
    }

    page = data.nextPage;
  }

  if (matches.length !== 1) {
    throw new Error("Owner account lookup failed.");
  }

  return matches[0];
}
