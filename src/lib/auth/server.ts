import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";

import { isOwner } from "./owner";

export type OwnerStatus =
  | { status: "anonymous" }
  | { status: "not_owner" }
  | { status: "owner"; user: User };

export async function getOwnerStatus(
  supabase: SupabaseClient<Database>,
): Promise<OwnerStatus> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "anonymous" };
  }

  if (!isOwner(user.email, process.env.ALLOWED_EMAIL)) {
    return { status: "not_owner" };
  }

  return { status: "owner", user };
}

export async function requireOwner(): Promise<User> {
  const supabase = await createClient();
  const ownerStatus = await getOwnerStatus(supabase);

  if (ownerStatus.status === "anonymous") {
    redirect("/login");
  }

  if (ownerStatus.status === "not_owner") {
    try {
      await supabase.auth.signOut();
    } catch {
      // Cookie writes can fail when this runs during Server Component rendering.
    }

    redirect("/private");
  }

  return ownerStatus.user;
}
