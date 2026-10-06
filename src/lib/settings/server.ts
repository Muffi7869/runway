import "server-only";

import { redirect } from "next/navigation";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";

export async function requireSettingsComplete() {
  const user = await requireOwner();
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("settings")
    .select(
      "study_window_start,study_window_end,max_study_minutes_per_day,min_block_minutes,max_block_minutes,buffer_days,timezone,check_in_time",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to check whether settings are complete.");
  }

  if (!settings || Object.values(settings).some((value) => value === null)) {
    redirect("/settings");
  }

  return settings;
}
