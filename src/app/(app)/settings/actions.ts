"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import {
  hoursAndMinutesToTotalMinutes,
  settingsSchema,
  totalMinutesToHoursAndMinutes,
  type SettingsInput,
} from "@/lib/settings/schema";

export type SettingsActionState = {
  errors?: Partial<Record<keyof SettingsInput, string[]>>;
  formError?: string;
  hasSavedCanvasUrl: boolean;
  successMessage?: string;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function numberValue(formData: FormData, name: string) {
  const value = textValue(formData, name).trim();
  return value === "" ? Number.NaN : Number(value);
}

function timeValue(formData: FormData, name: string) {
  const value = textValue(formData, name);
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return Number.NaN;
  }

  return hoursAndMinutesToTotalMinutes(Number(match[1]), Number(match[2]));
}

function databaseTime(totalMinutes: number) {
  const { hours, minutes } = totalMinutesToHoursAndMinutes(totalMinutes);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function saveSettings(
  previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireOwner();
  const submittedCanvasUrl = textValue(formData, "canvas_feed_url").trim();
  const result = settingsSchema.safeParse({
    study_window_start: timeValue(formData, "study_window_start"),
    study_window_end: timeValue(formData, "study_window_end"),
    max_study_minutes_per_day: hoursAndMinutesToTotalMinutes(
      numberValue(formData, "max_study_hours"),
      numberValue(formData, "max_study_minutes"),
    ),
    min_block_minutes: hoursAndMinutesToTotalMinutes(
      numberValue(formData, "min_block_hours"),
      numberValue(formData, "min_block_minutes"),
    ),
    max_block_minutes: hoursAndMinutesToTotalMinutes(
      numberValue(formData, "max_block_hours"),
      numberValue(formData, "max_block_minutes"),
    ),
    buffer_days: numberValue(formData, "buffer_days"),
    timezone: "America/Los_Angeles",
    check_in_time: timeValue(formData, "check_in_time"),
    canvas_feed_url: submittedCanvasUrl,
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      hasSavedCanvasUrl: previousState.hasSavedCanvasUrl,
    };
  }

  const settingsToSave: Database["public"]["Tables"]["settings"]["Insert"] = {
    user_id: user.id,
    study_window_start: databaseTime(result.data.study_window_start),
    study_window_end: databaseTime(result.data.study_window_end),
    max_study_minutes_per_day: result.data.max_study_minutes_per_day,
    min_block_minutes: result.data.min_block_minutes,
    max_block_minutes: result.data.max_block_minutes,
    buffer_days: result.data.buffer_days,
    timezone: result.data.timezone,
    check_in_time: databaseTime(result.data.check_in_time),
  };

  if (result.data.canvas_feed_url) {
    settingsToSave.canvas_feed_url = result.data.canvas_feed_url;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(settingsToSave, {
    onConflict: "user_id",
  });

  if (error) {
    return {
      formError: "Settings could not be saved. Please try again.",
      hasSavedCanvasUrl: previousState.hasSavedCanvasUrl,
    };
  }

  revalidatePath("/", "layout");

  return {
    hasSavedCanvasUrl:
      previousState.hasSavedCanvasUrl || Boolean(result.data.canvas_feed_url),
    successMessage: "Settings saved.",
  };
}
