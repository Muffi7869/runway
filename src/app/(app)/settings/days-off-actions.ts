"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { replan } from "@/lib/scheduler/replan";
import { validateDayOff } from "@/lib/settings/day-off";

export type DayOffActionState = {
  ok?: boolean;
  error?: string;
  errors?: { date?: string; reason?: string };
  note?: string;
};

function refreshDaysOff() {
  revalidatePath("/settings");
  revalidatePath("/week");
}

export async function addDayOffAction(
  _previousState: DayOffActionState,
  formData: FormData,
): Promise<DayOffActionState> {
  const user = await requireOwner();
  void _previousState;
  const validated = validateDayOff(
    { date: formData.get("date"), reason: formData.get("reason") },
    new Date(),
  );

  if (!validated.ok) {
    return { errors: validated.errors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_days").insert({
    user_id: user.id,
    date: validated.value.date,
    reason: validated.value.reason,
  });

  if (error?.code === "23505") {
    return { error: "That day is already a day off." };
  }

  if (error) {
    return { error: "Couldn't add the day off. Try again." };
  }

  const planResult = await replan(supabase, user.id);
  refreshDaysOff();
  return planResult.ok
    ? { ok: true }
    : { ok: true, note: "Day off saved. Replan didn't finish; press Replan." };
}

export async function removeDayOffAction(
  _previousState: DayOffActionState,
  formData: FormData,
): Promise<DayOffActionState> {
  const user = await requireOwner();
  void _previousState;
  const idResult = z.string().uuid().safeParse(formData.get("id"));

  if (!idResult.success) {
    return { error: "That day off is no longer available." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_days")
    .delete()
    .eq("id", idResult.data)
    .eq("user_id", user.id)
    .select("id");

  if (error || data.length === 0) {
    return { error: "Couldn't remove the day off. Try again." };
  }

  const planResult = await replan(supabase, user.id);
  refreshDaysOff();
  return planResult.ok
    ? { ok: true }
    : { ok: true, note: "Day off removed. Replan didn't finish; press Replan." };
}
