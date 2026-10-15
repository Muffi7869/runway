import { Suspense } from "react";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google/scopes";
import {
  formatTimeOfDay,
  parseTimeOfDay,
  totalMinutesToHoursAndMinutes,
} from "@/lib/settings/schema";
import { laDateKey } from "@/lib/settings/day-off";

import { AppearanceSection } from "./appearance-section";
import { CanvasFeedUrlSection } from "./canvas-feed-url-section";
import { DaysOffSection } from "./days-off-section";
import {
  GoogleCalendarSection,
  GoogleCalendarSectionLoading,
} from "./google-calendar-section";
import { SettingsForm, type SettingsFormValues } from "./settings-form";
import styles from "./settings.module.css";

type SearchParams = Promise<{
  google?: string | string[];
  missing?: string | string[];
}>;

const GOOGLE_MESSAGES = {
  connected: "Google Calendar connected.",
  denied: "Google access was not granted. Try again.",
  error: "Something went wrong connecting. Try again.",
  no_refresh_token: "Google did not provide long-term access. Try again.",
  wrong_account:
    "That's a different Google account. Connect the one you sign in with.",
} as const;

const ALLOWED_MISSING_SCOPE_NAMES = new Set(
  GOOGLE_CALENDAR_SCOPES.map((scope) =>
    scope.slice(scope.lastIndexOf("auth/") + 5),
  ),
);

function formatTimeInput(value: string) {
  const totalMinutes = parseTimeOfDay(value);
  return totalMinutes === null ? "" : formatTimeOfDay(totalMinutes);
}

function getGoogleMessage({
  google,
  missing,
}: Awaited<SearchParams>): string | undefined {
  if (typeof google !== "string") {
    return undefined;
  }

  if (google === "missing_scopes") {
    const allowedNames =
      typeof missing === "string"
        ? [...new Set(missing.split(","))].filter((name) =>
            ALLOWED_MISSING_SCOPE_NAMES.has(name),
          )
        : [];
    const missingText = allowedNames.length
      ? ` Missing: ${allowedNames.join(", ")}.`
      : "";

    return `Some permissions were not granted.${missingText} Please reconnect and allow all of them.`;
  }

  if (Object.hasOwn(GOOGLE_MESSAGES, google)) {
    return GOOGLE_MESSAGES[google as keyof typeof GOOGLE_MESSAGES];
  }

  return undefined;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireOwner();
  const supabase = await createClient();
  const today = laDateKey(new Date());
  const [settingsResult, canvasStatusResult, blockedDaysResult, query] =
    await Promise.all([
      supabase
        .from("settings")
        .select(
          "study_window_start,study_window_end,max_study_minutes_per_day,min_block_minutes,max_block_minutes,buffer_days,timezone,check_in_time",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("canvas_feed_url_encrypted")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("blocked_days")
        .select("id,date,reason")
        .eq("user_id", user.id)
        .gte("date", today)
        .order("date", { ascending: true }),
      searchParams,
    ]);
  const { data: settings, error: settingsError } = settingsResult;
  const { data: canvasSettings, error: canvasStatusError } = canvasStatusResult;
  const { data: blockedDays, error: blockedDaysError } = blockedDaysResult;

  if (settingsError || canvasStatusError || blockedDaysError) {
    throw new Error("Unable to load settings.");
  }

  const googleMessage = getGoogleMessage(query);

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
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.heading}>Settings</h1>
        <p>Set your study rhythm and connected services.</p>
      </header>
      <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHeader}><div><h2>Study window and limits</h2><p>Define when and how long Runway may plan work.</p></div></div>
        <SettingsForm initialValues={initialValues} />
      </section>
      <CanvasFeedUrlSection
        hasSavedUrl={Boolean(canvasSettings?.canvas_feed_url_encrypted)}
      />
      <DaysOffSection days={blockedDays} today={today} />
      <Suspense fallback={<GoogleCalendarSectionLoading />}>
        <GoogleCalendarSection
          googleMessage={googleMessage}
          userId={user.id}
        />
      </Suspense>
      <AppearanceSection />
      </div>
    </main>
  );
}
