"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import {
  formatTimeOfDay,
  hoursAndMinutesToTotalMinutes,
  parseTimeOfDay,
  settingsSchema,
  type SettingsInput,
} from "@/lib/settings/schema";

export type SettingsActionState = {
  errors?: Partial<Record<keyof SettingsInput, string[]>>;
  formError?: string;
  successMessage?: string;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function numberValue(formData: FormData, name: string) {
  const value = textValue(formData, name).trim();

  if (value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function durationValue(formData: FormData, hoursName: string, minutesName: string) {
  const hours = numberValue(formData, hoursName);
  const minutes = numberValue(formData, minutesName);

  if (hours === null || minutes === null) {
    return null;
  }

  return hoursAndMinutesToTotalMinutes(hours, minutes);
}

export async function saveSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireOwner();
  const result = settingsSchema.safeParse({
    study_window_start: parseTimeOfDay(
      textValue(formData, "study_window_start"),
    ),
    study_window_end: parseTimeOfDay(textValue(formData, "study_window_end")),
    max_study_minutes_per_day: durationValue(
      formData,
      "max_study_hours",
      "max_study_minutes",
    ),
    min_block_minutes: durationValue(
      formData,
      "min_block_hours",
      "min_block_minutes",
    ),
    max_block_minutes: durationValue(
      formData,
      "max_block_hours",
      "max_block_minutes",
    ),
    buffer_days: numberValue(formData, "buffer_days"),
    timezone: "America/Los_Angeles",
    check_in_time: parseTimeOfDay(textValue(formData, "check_in_time")),
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const settingsToSave: Database["public"]["Tables"]["settings"]["Insert"] = {
    user_id: user.id,
    study_window_start: formatTimeOfDay(result.data.study_window_start),
    study_window_end: formatTimeOfDay(result.data.study_window_end),
    max_study_minutes_per_day: result.data.max_study_minutes_per_day,
    min_block_minutes: result.data.min_block_minutes,
    max_block_minutes: result.data.max_block_minutes,
    buffer_days: result.data.buffer_days,
    timezone: result.data.timezone,
    check_in_time: formatTimeOfDay(result.data.check_in_time),
  };

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(settingsToSave, {
    onConflict: "user_id",
  });

  if (error) {
    return {
      formError: "Settings could not be saved. Please try again.",
    };
  }

  revalidatePath("/", "layout");

  return {
    successMessage: "Settings saved.",
  };
}
