import {
  addDays,
  APP_TIMEZONE,
  mondayOf,
  type CalendarDate,
  zonedParts,
  zonedTimeToUtc,
} from "../time/zoned";

export type WeekEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
};

export type WeekEventSegment = {
  id: string;
  title: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
};

export type WeekEventLayout = WeekEventSegment & {
  lane: number;
  laneCount: number;
};

const WEEK_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function isRealCalendarDate(date: CalendarDate): boolean {
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day) ||
    date.year < 1 ||
    date.year > 9999
  ) {
    return false;
  }

  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);

  return (
    value.getUTCFullYear() === date.year &&
    value.getUTCMonth() + 1 === date.month &&
    value.getUTCDate() === date.day
  );
}

function fallbackMonday(now: Date): CalendarDate {
  const current = zonedParts(now, APP_TIMEZONE);
  return mondayOf(current);
}

export function parseWeekParam(
  value: string | undefined,
  now: Date,
): CalendarDate {
  const match = value?.match(WEEK_PARAM_PATTERN);

  if (!match) {
    return fallbackMonday(now);
  }

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  return isRealCalendarDate(date) ? mondayOf(date) : fallbackMonday(now);
}

export function weekDays(monday: CalendarDate): CalendarDate[] {
  return Array.from({ length: 7 }, (_, dayIndex) =>
    addDays(monday, dayIndex),
  );
}

export function weekBounds(monday: CalendarDate): {
  start: Date;
  end: Date;
} {
  const nextMonday = addDays(monday, 7);

  return {
    start: zonedTimeToUtc(
      { ...monday, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
    end: zonedTimeToUtc(
      { ...nextMonday, hour: 0, minute: 0 },
      APP_TIMEZONE,
    ),
  };
}

function wallClockMinute(date: Date): number {
  const parts = zonedParts(date, APP_TIMEZONE);
  return parts.hour * 60 + parts.minute;
}

export function segmentEventsByDay(
  events: WeekEvent[],
  monday: CalendarDate,
): WeekEventSegment[] {
  const days = weekDays(monday);
  const bounds = weekBounds(monday);
  const segments: WeekEventSegment[] = [];

  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    if (
      !Number.isFinite(eventStart.getTime()) ||
      !Number.isFinite(eventEnd.getTime()) ||
      eventEnd.getTime() <= eventStart.getTime() ||
      eventEnd.getTime() <= bounds.start.getTime() ||
      eventStart.getTime() >= bounds.end.getTime()
    ) {
      continue;
    }

    const clippedStart = new Date(
      Math.max(eventStart.getTime(), bounds.start.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(eventEnd.getTime(), bounds.end.getTime()),
    );

    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex];
      const nextDay = addDays(day, 1);
      const dayStart = zonedTimeToUtc(
        { ...day, hour: 0, minute: 0 },
        APP_TIMEZONE,
      );
      const dayEnd = zonedTimeToUtc(
        { ...nextDay, hour: 0, minute: 0 },
        APP_TIMEZONE,
      );
      const segmentStart = new Date(
        Math.max(clippedStart.getTime(), dayStart.getTime()),
      );
      const segmentEnd = new Date(
        Math.min(clippedEnd.getTime(), dayEnd.getTime()),
      );

      if (segmentEnd.getTime() <= segmentStart.getTime()) {
        continue;
      }

      segments.push({
        id: event.id,
        title: event.title,
        dayIndex,
        startMinute:
          segmentStart.getTime() === dayStart.getTime()
            ? 0
            : wallClockMinute(segmentStart),
        endMinute:
          segmentEnd.getTime() === dayEnd.getTime()
            ? MINUTES_PER_DAY
            : wallClockMinute(segmentEnd),
      });
    }
  }

  return segments.sort(
    (first, second) =>
      first.dayIndex - second.dayIndex ||
      first.startMinute - second.startMinute ||
      first.endMinute - second.endMinute ||
      first.id.localeCompare(second.id),
  );
}

function layoutDay(segments: WeekEventSegment[]): WeekEventLayout[] {
  const result: WeekEventLayout[] = [];
  let group: WeekEventLayout[] = [];
  let groupEnd = -1;
  let active: Array<{ endMinute: number; lane: number }> = [];

  function finishGroup() {
    if (group.length === 0) {
      return;
    }

    const laneCount =
      Math.max(...group.map((segment) => segment.lane)) + 1;
    result.push(
      ...group.map((segment) => ({ ...segment, laneCount })),
    );
    group = [];
    active = [];
    groupEnd = -1;
  }

  for (const segment of segments) {
    if (group.length > 0 && segment.startMinute >= groupEnd) {
      finishGroup();
    }

    active = active.filter(
      (entry) => entry.endMinute > segment.startMinute,
    );
    const usedLanes = new Set(active.map((entry) => entry.lane));
    let lane = 0;

    while (usedLanes.has(lane)) {
      lane += 1;
    }

    const layout = { ...segment, lane, laneCount: 1 };
    group.push(layout);
    active.push({ endMinute: segment.endMinute, lane });
    groupEnd = Math.max(groupEnd, segment.endMinute);
  }

  finishGroup();
  return result;
}

export function assignLanes(
  segments: WeekEventSegment[],
): WeekEventLayout[] {
  const sorted = [...segments].sort(
    (first, second) =>
      first.dayIndex - second.dayIndex ||
      first.startMinute - second.startMinute ||
      first.endMinute - second.endMinute ||
      first.id.localeCompare(second.id),
  );
  const result: WeekEventLayout[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    result.push(
      ...layoutDay(
        sorted.filter((segment) => segment.dayIndex === dayIndex),
      ),
    );
  }

  return result;
}

export function hourRange({
  segments,
  studyWindowStartMinutes,
  studyWindowEndMinutes,
}: {
  segments: WeekEventSegment[];
  studyWindowStartMinutes: number;
  studyWindowEndMinutes: number;
}): { startHour: number; endHour: number } {
  const earliestMinute = Math.min(
    studyWindowStartMinutes,
    ...segments.map((segment) => segment.startMinute),
  );
  const latestMinute = Math.max(
    studyWindowEndMinutes,
    ...segments.map((segment) => segment.endMinute),
  );

  return {
    startHour: Math.max(0, Math.min(24, Math.floor(earliestMinute / 60))),
    endHour: Math.max(0, Math.min(24, Math.ceil(latestMinute / 60))),
  };
}

export function formatLastSynced(
  lastSyncedAt: string | Date | null | undefined,
  now: Date,
): string {
  if (!lastSyncedAt) {
    return "Never synced";
  }

  const syncedAt =
    lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt);

  if (!Number.isFinite(syncedAt.getTime())) {
    return "Never synced";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - syncedAt.getTime()) / 1_000),
  );

  if (elapsedSeconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(elapsedSeconds / 60);

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function formatTimeRange(
  start: string | Date,
  end: string | Date,
): string {
  return `${timeFormatter.format(new Date(start))} – ${timeFormatter.format(new Date(end))}`;
}
