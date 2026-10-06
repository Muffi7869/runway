"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/db/server";

export async function signOut() {
  // No requireOwner: this only clears the caller's own session and touches no data.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
