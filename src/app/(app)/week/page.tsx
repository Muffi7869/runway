import Link from "next/link";

import { ReplanControls } from "@/components/replan-controls";
import { RoughDayControls } from "@/components/rough-day-controls";
import { SyncControls, AutoSync } from "@/components/sync-controls";
import {
  WeekGrid,
  type WeekGridDay,
  type WeekGridEvent,
} from "@/components/week-grid";
import { requireOwner } from "@/lib/auth/server";
import { CLASS_COLOR_PALETTE } from "@/lib/classes/palette";
import { createClient } from "@/lib/db/server";
import { parseTimeOfDay } from "@/lib/settings/schema";
import { laDateKey } from "@/lib/settings/day-off";
import { requireSettingsComplete } from "@/lib/settings/server";
import { addDays, APP_TIMEZONE, type CalendarDate, zonedParts } from "@/lib/time/zoned";
import {
  assignLanes,
  formatTimeRange,
  hourRange,
  parseWeekParam,
  segmentEventsByDay,
  weekBounds,
  weekDays,
} from "@/lib/week/view";
import {
  buildPlannedBlockLabel,
  buildWarningSentences,
} from "@/lib/week/presentation";

export const maxDuration = 30;

type SearchParams = Promise<{ week?: string | string[] }>;

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
});
const longDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "short",
  day: "numeric",
});
const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function calendarDateAsUtc(date: CalendarDate): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  return value;
}

function weekParam(date: CalendarDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function weekLabel(days: CalendarDate[]): string {
  const first = days[0];
  const last = days[days.length - 1];

  if (first.year === last.year) {
    return `${monthDayFormatter.format(calendarDateAsUtc(first))} – ${monthDayFormatter.format(calendarDateAsUtc(last))}, ${last.year}`;
  }

  return `${fullDateFormatter.format(calendarDateAsUtc(first))} – ${fullDateFormatter.format(calendarDateAsUtc(last))}`;
}

function sameDate(first: CalendarDate, second: CalendarDate): boolean {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day
  );
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const settings = await requireSettingsComplete();
  const query = await searchParams;
  const now = new Date();
  const monday = parseWeekParam(
    typeof query.week === "string" ? query.week : undefined,
    now,
  );
  const days = weekDays(monday);
  const bounds = weekBounds(monday);
  const user = await requireOwner();
  const supabase = await createClient();
  const [
    connectionResult,
    fixedEventsResult,
    blocksResult,
    planningResult,
    activeAssignmentsResult,
    roughDayResult,
  ] = await Promise.all([
    supabase
      .from("google_connection")
      .select("status,fixed_calendar_ids,last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("fixed_events")
      .select("id,title,start,end")
      .eq("user_id", user.id)
      .lt("start", bounds.end.toISOString())
      .gt("end", bounds.start.toISOString())
      .order("start", { ascending: true }),
    supabase
      .from("blocks")
      .select(
        "id,start,end,step:steps!inner(id,name,assignment:assignments!inner(id,title,status,class:classes!inner(id,name,color)))",
      )
      .eq("user_id", user.id)
      .eq("status", "planned")
      .lt("start", bounds.end.toISOString())
      .gt("end", bounds.start.toISOString())
      .order("start", { ascending: true }),
    supabase
      .from("settings")
      .select("last_plan_warnings,last_planned_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("blocked_days")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", laDateKey(now))
      .eq("reason", "rough day")
      .maybeSingle(),
  ]);

  if (
    connectionResult.error ||
    fixedEventsResult.error ||
    blocksResult.error ||
    planningResult.error ||
    activeAssignmentsResult.error ||
    roughDayResult.error
  ) {
    throw new Error("Unable to load the week.");
  }

  const connection = connectionResult.data;
  const fixedEvents = fixedEventsResult.data;
  const plannedBlocks = blocksResult.data;
  const isConnected = connection?.status === "connected";
  const lastSyncedTime = connection?.last_synced_at
    ? Date.parse(connection.last_synced_at)
    : Number.NaN;
  const shouldAutoSync =
    isConnected &&
    connection.fixed_calendar_ids.length > 0 &&
    (!Number.isFinite(lastSyncedTime) ||
      now.getTime() - lastSyncedTime > 30 * 60 * 1000);

  if (!isConnected) {
    const needsReconnect = connection?.status === "needs_reconnect";

    return (
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Week</h1>
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium">
            {needsReconnect
              ? "Runway lost access to Google Calendar."
              : "Google Calendar isn't connected."}
          </p>
          <Link className="mt-2 inline-block underline" href="/settings">
            Open Settings
          </Link>
        </div>
      </main>
    );
  }

  const studyWindowStartMinutes = parseTimeOfDay(
    settings.study_window_start,
  );
  const studyWindowEndMinutes = parseTimeOfDay(settings.study_window_end);

  if (
    studyWindowStartMinutes === null ||
    studyWindowEndMinutes === null
  ) {
    throw new Error("Unable to read the study window.");
  }

  const colorByKey = new Map<string, string>(
    CLASS_COLOR_PALETTE.map((color) => [color.key, color.value]),
  );
  const fixedGridEvents = fixedEvents.map((event) => ({
    ...event,
    id: `fixed:${event.id}`,
  }));
  const plannedGridEvents = plannedBlocks.map((block) => ({
    id: `block:${block.id}`,
    title: buildPlannedBlockLabel({
      className: block.step.assignment.class.name,
      assignmentTitle: block.step.assignment.title,
      stepName: block.step.name,
    }),
    start: block.start,
    end: block.end,
    color: colorByKey.get(block.step.assignment.class.color) ?? "#4B5563",
  }));
  const allEvents = [...fixedGridEvents, ...plannedGridEvents];
  const segments = segmentEventsByDay(allEvents, monday);
  const layouts = assignLanes(segments);
  const range = hourRange({
    segments,
    studyWindowStartMinutes,
    studyWindowEndMinutes,
  });
  const eventTimes = new Map(
    allEvents.map((event) => [
      event.id,
      formatTimeRange(event.start, event.end),
    ]),
  );
  const plannedColors = new Map(
    plannedGridEvents.map((event) => [event.id, event.color]),
  );
  const gridEvents: WeekGridEvent[] = layouts.map((event) => {
    const backgroundColor = plannedColors.get(event.id);

    return {
      ...event,
      timeRange: eventTimes.get(event.id) ?? "",
      ...(backgroundColor
        ? {
            backgroundColor,
            textColor: backgroundColor === "#CA8A04" ? "#111827" : "#FFFFFF",
          }
        : {}),
    };
  });
  const warningSentences = buildWarningSentences(
    planningResult.data?.last_plan_warnings ?? null,
    activeAssignmentsResult.data,
  );
  const today = zonedParts(now, APP_TIMEZONE);
  const todayIndex = days.findIndex((day) => sameDate(day, today));
  const gridDays: WeekGridDay[] = days.map((day) => {
    const date = calendarDateAsUtc(day);

    return {
      shortLabel: shortDayFormatter.format(date),
      longLabel: longDayFormatter.format(date),
      isToday: sameDate(day, today),
    };
  });
  const previousMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);

  return (
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Week</h1>
          <p className="mt-1 text-gray-600">{weekLabel(days)}</p>
          <nav
            aria-label="Week navigation"
            className="mt-4 flex flex-wrap items-center gap-3 text-sm"
          >
            <Link
              className="rounded border px-3 py-2"
              href={`/week?week=${weekParam(previousMonday)}`}
            >
              Previous week
            </Link>
            <Link className="rounded border px-3 py-2" href="/week">
              This week
            </Link>
            <Link
              className="rounded border px-3 py-2"
              href={`/week?week=${weekParam(nextMonday)}`}
            >
              Next week
            </Link>
          </nav>
        </div>
        <div className="space-y-6">
          <SyncControls
            lastSyncedAt={connection.last_synced_at}
            now={now.toISOString()}
          />
          <div className="flex flex-wrap items-start gap-6">
            <ReplanControls
              lastPlannedAt={planningResult.data?.last_planned_at ?? null}
              now={now.toISOString()}
            />
            <RoughDayControls initiallyActive={Boolean(roughDayResult.data)} />
          </div>
        </div>
      </div>

      {warningSentences.length > 0 ? (
        <section
          aria-label="Planning warnings"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          {warningSentences.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}

      <div className="mt-6 min-w-0">
        <WeekGrid
          days={gridDays}
          endHour={range.endHour}
          events={gridEvents}
          initialDayIndex={todayIndex >= 0 ? todayIndex : 0}
          startHour={range.startHour}
        />
      </div>
      {shouldAutoSync ? <AutoSync /> : null}
    </main>
  );
}
