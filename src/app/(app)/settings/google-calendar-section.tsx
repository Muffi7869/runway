import { cache } from "react";

import { createClient } from "@/lib/db/server";
import { getAccessToken, GoogleAuthError } from "@/lib/google/access-token";
import {
  isRunwayCalendarCandidate,
  listCalendars,
} from "@/lib/google/calendar-api";
import { ensureRunwayCalendar } from "@/lib/google/runway-calendar";

import { CalendarPicker, type CalendarOption } from "./calendar-picker";
import styles from "./settings.module.css";

type GoogleConnectionStatus = "connected" | "needs_reconnect" | "none";

const loadGoogleCalendarData = cache(async (userId: string) => {
  const supabase = await createClient();
  const token = await getAccessToken(supabase, userId);
  const calendars = await listCalendars(token);
  return { calendars, token };
});

export async function GoogleCalendarSection({
  googleMessage,
  userId,
}: {
  googleMessage?: string;
  userId: string;
}) {
  const supabase = await createClient();
  const { data: googleConnection, error: googleConnectionError } =
    await supabase
      .from("google_connection")
      .select("status,fixed_calendar_ids")
      .eq("user_id", userId)
      .maybeSingle();

  if (googleConnectionError) {
    throw new Error("Unable to load settings.");
  }

  let googleStatus: GoogleConnectionStatus =
    googleConnection?.status === "connected" ||
    googleConnection?.status === "needs_reconnect"
      ? googleConnection.status
      : "none";
  let calendarOptions: CalendarOption[] | undefined;
  let selectedCalendarIds: string[] = [];
  let extraRunwayCalendars = 0;
  let googleLoadError: string | undefined;

  if (googleStatus === "connected") {
    try {
      const runwayCalendar = await ensureRunwayCalendar(supabase, userId, {
        getAccessToken: async () => (await loadGoogleCalendarData(userId)).token,
        listCalendars: async () =>
          (await loadGoogleCalendarData(userId)).calendars,
      });
      const { calendars } = await loadGoogleCalendarData(userId);
      const selectableCalendars = calendars.filter(
        (calendar) =>
          calendar.id !== runwayCalendar.calendarId &&
          !isRunwayCalendarCandidate(calendar),
      );
      const selectableIds = new Set(
        selectableCalendars.map((calendar) => calendar.id),
      );

      calendarOptions = selectableCalendars.map(
        ({ id, name, primary }): CalendarOption => ({ id, name, primary }),
      );
      selectedCalendarIds = (googleConnection?.fixed_calendar_ids ?? []).filter(
        (id) => selectableIds.has(id),
      );
      extraRunwayCalendars = runwayCalendar.extraRunwayCalendars;
    } catch (error) {
      if (
        error instanceof GoogleAuthError &&
        error.code === "needs_reconnect"
      ) {
        googleStatus = "needs_reconnect";
      } else {
        googleLoadError =
          "Couldn't load your Google calendars. Try again in a moment.";
      }
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Google Calendar</h2>
          <p>Choose the calendars Runway treats as fixed time.</p>
        </div>
      </div>
      {googleMessage ? <p>{googleMessage}</p> : null}
      {googleStatus === "connected" ? (
        <>
          <p className={styles.savedPill}>Connected</p>
          {googleLoadError ? (
            <p className={`${styles.message} ${styles.error}`}>
              {googleLoadError}
            </p>
          ) : null}
          {extraRunwayCalendars > 0 ? (
            <p className={styles.hint}>
              {`Found ${extraRunwayCalendars} extra calendars named "Runway" in your Google account. Runway uses one of them. You can delete the others in Google Calendar.`}
            </p>
          ) : null}
          {calendarOptions ? (
            <CalendarPicker
              calendars={calendarOptions}
              initialSelectedIds={selectedCalendarIds}
            />
          ) : null}
        </>
      ) : null}
      {googleStatus === "needs_reconnect" ? (
        <>
          <p>Runway lost access to Google Calendar.</p>
          <form action="/api/google/connect" method="get">
            <button className="ui-button ui-button--primary" type="submit">
              Reconnect
            </button>
          </form>
        </>
      ) : null}
      {googleStatus === "none" ? (
        <>
          <p>Not connected</p>
          <form action="/api/google/connect" method="get">
            <button className="ui-button ui-button--primary" type="submit">
              Connect Google Calendar
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

export function GoogleCalendarSectionLoading() {
  return (
    <section aria-busy="true" className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>Google Calendar</h2>
          <p>Loading calendars…</p>
        </div>
      </div>
    </section>
  );
}
