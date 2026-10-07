import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google/scopes";
import {
  formatTimeOfDay,
  parseTimeOfDay,
  totalMinutesToHoursAndMinutes,
} from "@/lib/settings/schema";

import { SettingsForm, type SettingsFormValues } from "./settings-form";

type SearchParams = Promise<{
  google?: string | string[];
  missing?: string | string[];
}>;

type GoogleConnectionStatus = "connected" | "needs_reconnect" | "none";

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
  const query = await searchParams;
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
  const { data: googleConnection, error: googleConnectionError } =
    await supabase
      .from("google_connection")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

  if (settingsError || canvasStatusError || googleConnectionError) {
    throw new Error("Unable to load settings.");
  }

  const googleStatus: GoogleConnectionStatus =
    googleConnection?.status === "connected" ||
    googleConnection?.status === "needs_reconnect"
      ? googleConnection.status
      : "none";
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
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm
        hasSavedCanvasUrl={(savedCanvasUrlCount ?? 0) > 0}
        initialValues={initialValues}
      />
      <section className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Google Calendar</h2>
        {googleMessage ? <p className="mt-3">{googleMessage}</p> : null}
        {googleStatus === "connected" ? (
          <p className="mt-3">Connected</p>
        ) : null}
        {googleStatus === "needs_reconnect" ? (
          <>
            <p className="mt-3">Runway lost access to Google Calendar.</p>
            <a
              className="mt-4 inline-block rounded bg-black px-4 py-2 text-white"
              href="/api/google/connect"
            >
              Reconnect
            </a>
          </>
        ) : null}
        {googleStatus === "none" ? (
          <>
            <p className="mt-3">Not connected</p>
            <a
              className="mt-4 inline-block rounded bg-black px-4 py-2 text-white"
              href="/api/google/connect"
            >
              Connect Google Calendar
            </a>
          </>
        ) : null}
      </section>
    </main>
  );
}
