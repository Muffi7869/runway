import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { totalMinutesToHoursAndMinutes } from "@/lib/settings/schema";

import { SettingsForm, type SettingsFormValues } from "./settings-form";

function formatTimeInput(value: string) {
  return value.slice(0, 5);
}

export default async function SettingsPage() {
  const user = await requireOwner();
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select(
      "study_window_start,study_window_end,max_study_minutes_per_day,min_block_minutes,max_block_minutes,buffer_days,timezone,check_in_time",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const { count: savedCanvasUrlCount, error: canvasStatusError } = await supabase
    .from("settings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("canvas_feed_url", "is", null)
    .neq("canvas_feed_url", "");

  if (settingsError || canvasStatusError) {
    throw new Error("Unable to load settings.");
  }

  let initialValues: SettingsFormValues = {
    study_window_start: "",
    study_window_end: "",
    max_study_hours: "",
    max_study_minutes: "",
    min_block_hours: "",
    min_block_minutes: "",
    max_block_hours: "",
    max_block_minutes: "",
    buffer_days: "",
    check_in_time: "23:30",
  };

  if (settings) {
    const maximumStudyTime = totalMinutesToHoursAndMinutes(
      settings.max_study_minutes_per_day,
    );
    const minimumBlockTime = totalMinutesToHoursAndMinutes(
      settings.min_block_minutes,
    );
    const maximumBlockTime = totalMinutesToHoursAndMinutes(
      settings.max_block_minutes,
    );

    initialValues = {
      study_window_start: formatTimeInput(settings.study_window_start),
      study_window_end: formatTimeInput(settings.study_window_end),
      max_study_hours: String(maximumStudyTime.hours),
      max_study_minutes: String(maximumStudyTime.minutes),
      min_block_hours: String(minimumBlockTime.hours),
      min_block_minutes: String(minimumBlockTime.minutes),
      max_block_hours: String(maximumBlockTime.hours),
      max_block_minutes: String(maximumBlockTime.minutes),
      buffer_days: String(settings.buffer_days),
      check_in_time: formatTimeInput(settings.check_in_time),
    };
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm
        hasSavedCanvasUrl={(savedCanvasUrlCount ?? 0) > 0}
        initialValues={initialValues}
      />
    </main>
  );
}
