import { APP_TIMEZONE, type CalendarDate, zonedParts } from "../time/zoned";
import type { WeekEventLayout } from "./view";

export type HourRangeItem = {
  startMinute: number;
  endMinute: number;
};

export function visibleHourRange(
  settings: {
    studyWindowStartMinutes: number;
    studyWindowEndMinutes: number;
  },
  items: readonly HourRangeItem[],
): { startHour: number; endHour: number } {
  const starts = items.map((item) => item.startMinute);
  const ends = items.map((item) => item.endMinute);
  const earliest = Math.min(settings.studyWindowStartMinutes, ...starts);
  const latest = Math.max(settings.studyWindowEndMinutes, ...ends);

  return {
    startHour: Math.max(0, Math.min(24, Math.floor(earliest / 60))),
    endHour: Math.max(0, Math.min(24, Math.ceil(latest / 60))),
  };
}

export type VisualBlock = {
  id: string;
  assignmentId: string;
  className: string;
  assignmentTitle: string;
  stepName: string;
  start: string;
  end: string;
  plannedMinutes: number;
  status: "planned" | "checked_in" | "missed";
};

export type MergedVisualBlock = Omit<VisualBlock, "id" | "stepName"> & {
  id: string;
  blockIds: string[];
  stepNames: string[];
};

function laDayKey(value: string): string {
  const parts = zonedParts(new Date(value), APP_TIMEZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function mergeAdjacentBlocks(
  blocks: readonly VisualBlock[],
): MergedVisualBlock[] {
  const sorted = [...blocks].sort(
    (first, second) =>
      Date.parse(first.start) - Date.parse(second.start) ||
      first.id.localeCompare(second.id),
  );
  const merged: MergedVisualBlock[] = [];

  for (const block of sorted) {
    const previous = merged.at(-1);
    const canMerge =
      previous !== undefined &&
      previous.assignmentId === block.assignmentId &&
      previous.status === block.status &&
      Date.parse(previous.end) === Date.parse(block.start) &&
      laDayKey(previous.start) === laDayKey(block.start);

    if (!canMerge) {
      merged.push({
        ...block,
        id: block.id,
        blockIds: [block.id],
        stepNames: [block.stepName],
      });
      continue;
    }

    previous.end = block.end;
    previous.plannedMinutes += block.plannedMinutes;
    previous.blockIds.push(block.id);
    if (!previous.stepNames.includes(block.stepName)) {
      previous.stepNames.push(block.stepName);
    }
  }

  return merged;
}

export function stepSummary(block: Pick<MergedVisualBlock, "stepNames">): string {
  return block.stepNames.length === 1
    ? block.stepNames[0]
    : `${block.stepNames.length} steps`;
}

export function fullBlockLabel(
  block: Pick<MergedVisualBlock, "className" | "assignmentTitle" | "stepNames">,
): string {
  return `${block.className} · ${block.assignmentTitle} · ${stepSummary(block)}`;
}

export function blockLabel(
  block: Pick<MergedVisualBlock, "className" | "assignmentTitle" | "stepNames">,
  heightPx: number,
): string {
  if (heightPx < 42) {
    return block.assignmentTitle;
  }
  if (heightPx < 70) {
    return `${block.assignmentTitle} · ${stepSummary(block)}`;
  }
  return fullBlockLabel(block);
}

function removeLeadingBracketGroup(value: string): string | null {
  if (!value.startsWith("[")) return null;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "[") depth += 1;
    if (value[index] === "]") depth -= 1;
    if (depth === 0) return value.slice(index + 1).trimStart();
  }
  return null;
}

function removeTrailingBracketGroup(value: string): string | null {
  if (!value.endsWith("]")) return null;
  let depth = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] === "]") depth += 1;
    if (value[index] === "[") depth -= 1;
    if (depth === 0) return value.slice(0, index).trimEnd();
  }
  return null;
}

export function cleanEventTitle(title: string): string {
  const original = title.trim();
  let result = original;
  let changed = true;

  while (changed && result) {
    changed = false;
    const withoutLeading = removeLeadingBracketGroup(result);
    if (withoutLeading !== null) {
      result = withoutLeading;
      changed = true;
    }
    const withoutTrailing = removeTrailingBracketGroup(result);
    if (withoutTrailing !== null) {
      result = withoutTrailing;
      changed = true;
    }
  }

  return result || original;
}

export type LaneOverflow = {
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  hiddenCount: number;
};

export function limitLanes<T extends WeekEventLayout>(
  placed: readonly T[],
  maxLanes = 2,
): { visible: T[]; hidden: LaneOverflow[] } {
  const laneLimit = Number.isInteger(maxLanes) ? Math.max(1, maxLanes) : 2;
  const visible: T[] = [];
  const hidden: LaneOverflow[] = [];
  const sorted = [...placed].sort(
    (first, second) =>
      first.dayIndex - second.dayIndex ||
      first.startMinute - second.startMinute ||
      first.endMinute - second.endMinute,
  );

  for (let index = 0; index < sorted.length; ) {
    const first = sorted[index];
    const cluster: T[] = [first];
    let endMinute = first.endMinute;
    let cursor = index + 1;

    while (
      cursor < sorted.length &&
      sorted[cursor].dayIndex === first.dayIndex &&
      sorted[cursor].startMinute < endMinute
    ) {
      cluster.push(sorted[cursor]);
      endMinute = Math.max(endMinute, sorted[cursor].endMinute);
      cursor += 1;
    }

    const shown = cluster.filter((item) => item.lane < laneLimit);
    visible.push(
      ...shown.map((item) => ({
        ...item,
        laneCount: Math.min(item.laneCount, laneLimit),
      })),
    );
    const hiddenCount = cluster.length - shown.length;
    if (hiddenCount > 0) {
      hidden.push({
        dayIndex: first.dayIndex,
        startMinute: Math.min(...cluster.map((item) => item.startMinute)),
        endMinute,
        hiddenCount,
      });
    }
    index = cursor;
  }

  return { visible, hidden };
}

function dateNumber(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function isPastDay(day: CalendarDate, now: Date): boolean {
  const today = zonedParts(now, APP_TIMEZONE);
  return dateNumber(day) < dateNumber(today);
}

export function weekPlannedStat(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  const duration = hours > 0
    ? `${hours}h${remaining > 0 ? ` ${remaining}m` : ""}`
    : `${remaining}m`;
  return `${duration} planned`;
}
