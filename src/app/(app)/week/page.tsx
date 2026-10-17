import Link from "next/link";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

import { ActionMenu } from "@/components/action-menu";
import { ReplanControls } from "@/components/replan-controls";
import { RoughDayControls } from "@/components/rough-day-controls";
import { SyncControls } from "@/components/sync-controls";
import { Banner } from "@/components/ui/banner";
import { WeekTodayPanel, type TodayBlockItem } from "@/components/week-today-panel";
import {
  WeekGrid,
  type WeekGridDay,
  type WeekGridEvent,
} from "@/components/week-grid";
import { requireOwner } from "@/lib/auth/server";
import { formatEstimate } from "@/lib/assignments/helpers";
import { CLASS_COLOR_PALETTE, type ClassColor } from "@/lib/classes/palette";
import { createClient } from "@/lib/db/server";
import { syncFixedEventsOnce } from "@/lib/google/sync-service";
import { parseTimeOfDay } from "@/lib/settings/schema";
import { laDateKey } from "@/lib/settings/day-off";
import { requireSettingsComplete } from "@/lib/settings/server";
import {
  addDays,
  APP_TIMEZONE,
  type CalendarDate,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/time/zoned";
import {
  cleanEventTitle,
  fullBlockLabel,
  isPastDay,
  limitLanes,
  mergeAdjacentBlocks,
  visibleHourRange,
  weekPlannedStat,
  type VisualBlock,
} from "@/lib/week/declutter";
import {
  assignLanes,
  formatTimeRange,
  formatLastSynced,
  parseWeekParam,
  segmentEventsByDay,
  weekBounds,
  weekDays,
} from "@/lib/week/view";
import {
  assignmentProgress,
  buildWarningSentences,
  limitBannerItems,
} from "@/lib/week/presentation";

import styles from "./week.module.css";

export const maxDuration = 30;

type SearchParams = Promise<{ week?: string | string[] }>;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});
const dayNumberFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
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
const todayDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dueDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
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

function classColor(value: string): ClassColor {
  return CLASS_COLOR_PALETTE.some((color) => color.key === value)
    ? (value as ClassColor)
    : "blue";
}

function blockStatus(value: string): TodayBlockItem["status"] {
  return value === "checked_in" || value === "missed" ? value : "planned";
}

function formatClockMinutes(minutes: number): string {
  const date = new Date(Date.UTC(2026, 0, 1, 0, minutes));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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
        "id,start,end,planned_minutes,status,step:steps!inner(id,name,assignment:assignments!inner(id,title,status,class:classes!inner(id,name,color)))",
      )
      .eq("user_id", user.id)
      .in("status", ["planned", "checked_in", "missed"])
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
      .select(
        "id,title,deadline,class:classes!inner(name,color),steps(estimated_minutes,percent_done)",
      )
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

  if (shouldAutoSync) {
    after(async () => {
      try {
        const result = await syncFixedEventsOnce({
          supabase,
          userId: user.id,
          now,
        });

        if (
          result.ok &&
          result.inserted + result.updated + result.removed > 0
        ) {
          revalidatePath("/week");
        }
      } catch {
        // Automatic refresh is best effort; Sync now remains the retry path.
      }
    });
  }

  if (!isConnected) {
    const needsReconnect = connection?.status === "needs_reconnect";

    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>This week</h1>
            <p>{weekLabel(days)}</p>
          </div>
        </header>
        <Banner className={styles.disconnected} variant="warn">
          <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.6} />
          <div>
            <p>
              {needsReconnect
                ? "Runway lost access to Google Calendar."
                : "Google Calendar isn't connected."}
            </p>
            <Link href="/settings">Open Settings</Link>
          </div>
        </Banner>
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

  const colorByKey = new Map<string, { fill: string; text: string }>(
    CLASS_COLOR_PALETTE.map((color) => [
      color.key,
      { fill: color.fill, text: color.text },
    ]),
  );
  const fixedGridEvents = fixedEvents.map((event) => ({
    ...event,
    id: `fixed:${event.id}`,
    title: cleanEventTitle(event.title),
    fullTitle: event.title,
    kind: "fixed" as const,
  }));
  const visualBlocks: VisualBlock[] = plannedBlocks.map((block) => ({
    id: block.id,
    assignmentId: block.step.assignment.id,
    className: block.step.assignment.class.name,
    assignmentTitle: block.step.assignment.title,
    stepName: block.step.name,
    start: block.start,
    end: block.end,
    plannedMinutes: block.planned_minutes,
    status: blockStatus(block.status),
  }));
  const plannedGridEvents = mergeAdjacentBlocks(visualBlocks).map((block) => ({
    id: `block:${block.blockIds.join(":")}`,
    title: fullBlockLabel({
      className: block.className,
      assignmentTitle: block.assignmentTitle,
      stepNames: block.stepNames,
    }),
    start: block.start,
    end: block.end,
    status: block.status,
    kind: "block" as const,
    fullTitle: fullBlockLabel(block),
    className: block.className,
    assignmentTitle: block.assignmentTitle,
    stepNames: block.stepNames,
    color: colorByKey.get(
      plannedBlocks.find((row) => row.id === block.blockIds[0])?.step.assignment.class.color ?? "",
    ) ?? {
      fill: "var(--surface-2)",
      text: "var(--ink-2)",
    },
  }));
  const allEvents = [...fixedGridEvents, ...plannedGridEvents];
  const segments = segmentEventsByDay(allEvents, monday);
  const limitedLayouts = limitLanes(assignLanes(segments));
  const range = visibleHourRange({
    studyWindowStartMinutes,
    studyWindowEndMinutes,
  }, segments);
  const eventTimes = new Map(
    allEvents.map((event) => [
      event.id,
      formatTimeRange(event.start, event.end),
    ]),
  );
  const plannedPresentation = new Map(
    plannedGridEvents.map((event) => [
      event.id,
      { color: event.color, status: event.status },
    ]),
  );
  const eventDetails = new Map(
    allEvents.map((event) => [event.id, event]),
  );
  const gridEvents: WeekGridEvent[] = limitedLayouts.visible.map((event) => {
    const presentation = plannedPresentation.get(event.id);
    const details = eventDetails.get(event.id);

    return {
      ...event,
      kind: details?.kind ?? "fixed",
      fullTitle: details?.fullTitle ?? event.title,
      ...(details?.kind === "block"
        ? {
            className: details.className,
            assignmentTitle: details.assignmentTitle,
            stepNames: details.stepNames,
          }
        : {}),
      timeRange: eventTimes.get(event.id) ?? "",
      ...(presentation ? { status: presentation.status } : {}),
      ...(presentation
        ? {
            backgroundColor: presentation.color.fill,
            textColor: presentation.color.text,
          }
        : {}),
    };
  });
  const warningSentences = buildWarningSentences(
    planningResult.data?.last_plan_warnings ?? null,
    activeAssignmentsResult.data,
  );
  const limitedWarnings = limitBannerItems(warningSentences);
  const today = zonedParts(now, APP_TIMEZONE);
  const todayIndex = days.findIndex((day) => sameDate(day, today));
  const gridDays: WeekGridDay[] = days.map((day) => {
    const date = calendarDateAsUtc(day);

    return {
      shortLabel: `${weekdayFormatter.format(date)} ${dayNumberFormatter.format(date)}`,
      weekdayLabel: weekdayFormatter.format(date),
      dayLabel: dayNumberFormatter.format(date),
      longLabel: longDayFormatter.format(date),
      isToday: sameDate(day, today),
      isPast: isPastDay(day, now),
      visibleStart: zonedTimeToUtc(
        { ...day, hour: range.startHour, minute: 0 },
        APP_TIMEZONE,
      ).toISOString(),
    };
  });
  const previousMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);
  const todayKey = laDateKey(now);
  const todayBlocks: TodayBlockItem[] = plannedBlocks
    .filter((block) => laDateKey(new Date(block.start)) === todayKey)
    .map((block) => ({
      id: block.id,
      label: fullBlockLabel({
        className: block.step.assignment.class.name,
        assignmentTitle: block.step.assignment.title,
        stepNames: [block.step.name],
      }),
      detail: formatTimeRange(block.start, block.end),
      color: classColor(block.step.assignment.class.color),
      status: blockStatus(block.status),
    }));
  const upNext =
    todayBlocks.find((block) => {
      const source = plannedBlocks.find((row) => row.id === block.id);
      return (
        block.status === "planned" &&
        source !== undefined &&
        new Date(source.start).getTime() >= now.getTime()
      );
    }) ?? null;
  const plannedTodayMinutes = plannedBlocks
    .filter((block) => laDateKey(new Date(block.start)) === todayKey)
    .reduce((sum, block) => sum + block.planned_minutes, 0);
  const checkedInTodayMinutes = plannedBlocks
    .filter(
      (block) =>
        block.status === "checked_in" &&
        laDateKey(new Date(block.start)) === todayKey,
    )
    .reduce((sum, block) => sum + block.planned_minutes, 0);
  const weekPlannedMinutes = plannedBlocks.reduce(
    (sum, block) => sum + block.planned_minutes,
    0,
  );
  const checkinMinutes = parseTimeOfDay(settings.check_in_time);
  const dueSoon = [...activeAssignmentsResult.data]
    .sort(
      (first, second) =>
        new Date(first.deadline).getTime() - new Date(second.deadline).getTime(),
    )
    .slice(0, 3)
    .map((assignment) => ({
      id: assignment.id,
      label: `${assignment.class.name} · ${assignment.title}`,
      dueLabel: dueDateFormatter.format(new Date(assignment.deadline)),
      progress: assignmentProgress(assignment.steps),
      color: classColor(assignment.class.color),
    }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>This week</h1>
          <p>{weekLabel(days)}</p>
          <p className={styles.weekStat}>{weekPlannedStat(weekPlannedMinutes)}</p>
        </div>
        <div className={styles.headerActions}>
          <nav aria-label="Week navigation" className={styles.weekNavigation}>
            <Link
              aria-label="Previous week"
              className="ui-button ui-button--icon"
              href={`/week?week=${weekParam(previousMonday)}`}
            >
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.6} />
            </Link>
            <Link className="ui-button" href="/week">
              Today
            </Link>
            <Link
              aria-label="Next week"
              className="ui-button ui-button--icon"
              href={`/week?week=${weekParam(nextMonday)}`}
            >
              <ChevronRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </Link>
          </nav>
          <RoughDayControls initiallyActive={Boolean(roughDayResult.data)} />
          <ReplanControls
            lastPlannedAt={planningResult.data?.last_planned_at ?? null}
            now={now.toISOString()}
            showStatus={false}
          />
          <ActionMenu label="More Week actions">
            <SyncControls
              lastSyncedAt={connection.last_synced_at}
              menuItem
              now={now.toISOString()}
              showStatus={false}
            />
          </ActionMenu>
        </div>
      </header>

      <p className={styles.statusLine}>
        {planningResult.data?.last_planned_at
          ? `Updated ${formatLastSynced(planningResult.data.last_planned_at, now)}`
          : "Not planned yet"}
        {" · "}Synced {formatLastSynced(connection.last_synced_at, now)}
      </p>

      {warningSentences.length > 0 ? (
        <Banner className={styles.warning} variant="warn">
          <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.6} />
          <div aria-label="Planning warnings">
          {limitedWarnings.shown.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {limitedWarnings.more > 0 ? <p>+{limitedWarnings.more} more</p> : null}
          </div>
        </Banner>
      ) : null}

      <div className={styles.content}>
        <div className={styles.calendarWrap}>
          <WeekGrid
            days={gridDays}
            endHour={range.endHour}
            events={gridEvents}
            overflows={limitedLayouts.hidden}
            initialDayIndex={todayIndex >= 0 ? todayIndex : 0}
            now={now.toISOString()}
            startHour={range.startHour}
          />
        </div>
        <WeekTodayPanel
          checkinTime={
            checkinMinutes === null ? "11:30 PM" : formatClockMinutes(checkinMinutes)
          }
          completionPercent={
            plannedTodayMinutes === 0
              ? 0
              : Math.round((checkedInTodayMinutes / plannedTodayMinutes) * 100)
          }
          dateLabel={todayDateFormatter.format(now)}
          dueSoon={dueSoon}
          plannedLabel={formatEstimate(plannedTodayMinutes)}
          plannedToday={todayBlocks}
          uncheckedCount={todayBlocks.filter((block) => block.status !== "checked_in").length}
          upNext={upNext}
        />
      </div>
    </main>
  );
}
