"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { getAccessToken } from "@/lib/google/access-token";
import {
  isRunwayCalendarCandidate,
  listCalendars,
} from "@/lib/google/calendar-api";
import { calendarSelectionSchema } from "@/lib/google/calendar-selection";

export type CalendarActionState = {
  formError?: string;
  successMessage?: string;
};

export async function saveCalendars(
  _previousState: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const user = await requireOwner();
  const result = calendarSelectionSchema.safeParse(
    formData.getAll("calendar_ids"),
  );

  if (!result.success) {
    return { formError: result.error.issues[0]?.message };
  }

  const supabase = await createClient();

  try {
    const token = await getAccessToken(supabase, user.id);
    const [calendars, connectionResult] = await Promise.all([
      listCalendars(token),
      supabase
        .from("google_connection")
        .select("runway_calendar_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (connectionResult.error || !connectionResult.data) {
      return { formError: "Calendars could not be saved. Try again." };
    }

    const runwayCalendarId = connectionResult.data.runway_calendar_id;
    const allowedIds = new Set(
      calendars
        .filter(
          (calendar) =>
            calendar.id !== runwayCalendarId &&
            !isRunwayCalendarCandidate(calendar),
        )
        .map((calendar) => calendar.id),
    );

    if (result.data.some((calendarId) => !allowedIds.has(calendarId))) {
      return {
        formError: "Your calendar list changed. Refresh and try again.",
      };
    }

    const { error } = await supabase
      .from("google_connection")
      .update({ fixed_calendar_ids: result.data })
      .eq("user_id", user.id);

    if (error) {
      return { formError: "Calendars could not be saved. Try again." };
    }
  } catch {
    return { formError: "Calendars could not be saved. Try again." };
  }

  revalidatePath("/settings");

  return { successMessage: "Calendars saved." };
}
