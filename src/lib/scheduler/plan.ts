import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
  type CalendarDate,
} from "../time/zoned";
import type {
  BusyInterval,
  PlannedBlock,
  ScheduleAssignment,
  ScheduleInput,
  ScheduleResult,
  ScheduleStep,
  SchedulerSettings,
} from "./types";

const MINUTE_MS = 60_000;
const DAY_LIMIT = 400;
const WEIGHT_ORDER = { high: 0, medium: 1, low: 2 } as const;

type MillisecondInterval = { start: number; end: number };

type DayState = {
  date: CalendarDate;
  key: string;
  dayStart: number;
  dayEnd: number;
  free: MillisecondInterval[];
  usedMinutes: number;
};

type StepRemainder = {
  step: ScheduleStep;
  minutes: number;
};

function dateKey(date: CalendarDate): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.year).padStart(4, "0")}-${pad(date.month)}-${pad(date.day)}`;
}

function instantAt(date: CalendarDate, minutes: number): number {
  return zonedTimeToUtc(
    {
      ...date,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    },
    APP_TIMEZONE,
  ).getTime();
}

function dayBounds(date: CalendarDate): MillisecondInterval {
  return {
    start: instantAt(date, 0),
    end: instantAt(addDays(date, 1), 0),
  };
}

function ceilToMinutes(value: number, increment: number): number {
  const incrementMs = increment * MINUTE_MS;
  return Math.ceil(value / incrementMs) * incrementMs;
}

function roundMinutesUp(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

function intersect(
  interval: MillisecondInterval,
  bounds: MillisecondInterval,
): MillisecondInterval | null {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : null;
}

function mergeIntervals(intervals: MillisecondInterval[]): MillisecondInterval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: MillisecondInterval[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);

    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }

  return merged;
}

function subtractIntervals(
  source: MillisecondInterval,
  busy: MillisecondInterval[],
): MillisecondInterval[] {
  let free = [source];

  for (const occupied of mergeIntervals(busy)) {
    free = free.flatMap((slot) => {
      const overlap = intersect(slot, occupied);

      if (!overlap) {
        return [slot];
      }

      return [
        ...(slot.start < overlap.start
          ? [{ start: slot.start, end: overlap.start }]
          : []),
        ...(overlap.end < slot.end
          ? [{ start: overlap.end, end: slot.end }]
          : []),
      ];
    });
  }

  return free;
}

function intervalMinutes(intervals: MillisecondInterval[]): number {
  return Math.ceil(
    intervals.reduce(
      (total, interval) => total + (interval.end - interval.start),
      0,
    ) / MINUTE_MS,
  );
}

function normalizeIntervals(intervals: BusyInterval[]): MillisecondInterval[] {
  return intervals
    .map((interval) => ({
      start: interval.start.getTime(),
      end: interval.end.getTime(),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.start) &&
        Number.isFinite(interval.end) &&
        interval.end > interval.start,
    );
}

function buildDays(input: ScheduleInput, roundedNow: number): DayState[] {
  const todayParts = zonedParts(input.now, APP_TIMEZONE);
  const today = {
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day,
  };
  const horizon = input.horizonEnd.getTime();
  const fixed = normalizeIntervals(input.fixedEvents).map((event) => ({
    start: event.start - 15 * MINUTE_MS,
    end: event.end + 15 * MINUTE_MS,
  }));
  const busyBlocks = normalizeIntervals(input.busyBlocks);
  const blocked = new Set([...input.blockedDays].sort());
  const days: DayState[] = [];

  for (let offset = 0; offset < DAY_LIMIT; offset += 1) {
    const date = addDays(today, offset);
    const bounds = dayBounds(date);

    if (bounds.start >= horizon) {
      break;
    }

    const dayKey = dateKey(date);
    const study = {
      start: instantAt(date, input.settings.study_window_start),
      end: instantAt(date, input.settings.study_window_end),
    };
    const occupied = [...fixed, ...busyBlocks]
      .map((interval) => intersect(interval, study))
      .filter((interval): interval is MillisecondInterval => interval !== null);
    const busyOnDay = busyBlocks
      .map((interval) => intersect(interval, bounds))
      .filter((interval): interval is MillisecondInterval => interval !== null);
    const usableStudy = {
      start: Math.max(study.start, roundedNow),
      end: Math.min(study.end, horizon),
    };
    const free =
      blocked.has(dayKey) || usableStudy.end <= usableStudy.start
        ? []
        : subtractIntervals(usableStudy, occupied);

    days.push({
      date,
      key: dayKey,
      dayStart: bounds.start,
      dayEnd: bounds.end,
      free,
      usedMinutes: intervalMinutes(mergeIntervals(busyOnDay)),
    });
  }

  return days;
}

function workingDeadline(
  assignment: ScheduleAssignment,
  settings: SchedulerSettings,
  now: number,
): number {
  const realDeadline = assignment.deadline.getTime();
  const parts = zonedParts(assignment.deadline, APP_TIMEZONE);
  const bufferedDate = addDays(parts, -settings.buffer_days);
  const buffered = zonedTimeToUtc(
    {
      ...bufferedDate,
      hour: parts.hour,
      minute: parts.minute,
    },
    APP_TIMEZONE,
  ).getTime();

  return buffered < now ? realDeadline : buffered;
}

function remainingSteps(assignment: ScheduleAssignment): StepRemainder[] {
  return [...assignment.steps]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .flatMap((step) => {
      if (step.percentDone >= 100) {
        return [];
      }

      const raw = Math.ceil(
        step.estimatedMinutes *
          (1 - step.percentDone / 100) *
          assignment.paceRatio,
      );
      const minutes = roundMinutesUp(raw, 5);
      return minutes > 0 ? [{ step, minutes }] : [];
    });
}

function capacityForDay(
  day: DayState,
  cutoff: number,
  settings: SchedulerSettings,
): number {
  const timeCapacity = intervalMinutes(
    day.free
      .map((slot) => intersect(slot, { start: day.dayStart, end: cutoff }))
      .filter((slot): slot is MillisecondInterval => slot !== null),
  );
  const dailyCapacity = Math.max(
    0,
    settings.max_study_minutes_per_day - day.usedMinutes,
  );
  return Math.min(timeCapacity, dailyCapacity);
}

function takeBlock(
  day: DayState,
  cutoff: number,
  notBefore: number,
  desiredMinutes: number,
  stepRemaining: number,
  settings: SchedulerSettings,
): { start: number; end: number; minutes: number } | null {
  const dailyRemaining = Math.max(
    0,
    settings.max_study_minutes_per_day - day.usedMinutes,
  );

  if (dailyRemaining <= 0 || desiredMinutes <= 0) {
    return null;
  }

  for (let index = 0; index < day.free.length; index += 1) {
    const slot = day.free[index];
    const start = ceilToMinutes(Math.max(slot.start, notBefore), 5);
    const endLimit = Math.min(slot.end, cutoff);
    const slotMinutes = Math.floor((endLimit - start) / MINUTE_MS);

    if (slotMinutes <= 0) {
      continue;
    }

    let minutes = Math.min(
      settings.max_block_minutes,
      desiredMinutes,
      stepRemaining,
      dailyRemaining,
      slotMinutes,
    );
    minutes = Math.floor(minutes / 5) * 5;

    const isLastPiece = stepRemaining <= minutes;

    if (minutes < settings.min_block_minutes && !isLastPiece) {
      const minimumFits = Math.min(
        stepRemaining,
        settings.min_block_minutes,
      );

      if (
        desiredMinutes < settings.min_block_minutes &&
        minimumFits <= dailyRemaining &&
        minimumFits <= slotMinutes
      ) {
        minutes = minimumFits;
      } else {
        continue;
      }
    }

    if (minutes <= 0) {
      continue;
    }

    const end = start + minutes * MINUTE_MS;
    const replacement = [
      ...(slot.start < start ? [{ start: slot.start, end: start }] : []),
      ...(end < slot.end ? [{ start: end, end: slot.end }] : []),
    ];
    day.free.splice(index, 1, ...replacement);
    day.usedMinutes += minutes;
    return { start, end, minutes };
  }

  return null;
}

function placeMinutes({
  assignment,
  days,
  cutoff,
  remainders,
  desired,
  settings,
  blocks,
  sequence,
}: {
  assignment: ScheduleAssignment;
  days: DayState[];
  cutoff: number;
  remainders: StepRemainder[];
  desired: number;
  settings: SchedulerSettings;
  blocks: PlannedBlock[];
  sequence: { notBefore: number; latestEndByStep: Map<string, number> };
}): number {
  let remainingDesired = desired;

  while (remainingDesired > 0 && remainders.length > 0) {
    const current = remainders[0];
    let placement: ReturnType<typeof takeBlock> = null;

    for (const day of days) {
      placement = takeBlock(
        day,
        cutoff,
        sequence.notBefore,
        remainingDesired,
        current.minutes,
        settings,
      );

      if (placement) {
        blocks.push({
          stepId: current.step.id,
          assignmentId: assignment.id,
          start: new Date(placement.start),
          end: new Date(placement.end),
          minutes: placement.minutes,
        });
        sequence.latestEndByStep.set(
          current.step.id,
          Math.max(
            sequence.latestEndByStep.get(current.step.id) ?? 0,
            placement.end,
          ),
        );
        current.minutes -= placement.minutes;
        remainingDesired -= placement.minutes;

        if (current.minutes === 0) {
          sequence.notBefore = Math.max(
            sequence.notBefore,
            sequence.latestEndByStep.get(current.step.id) ?? sequence.notBefore,
          );
          remainders.shift();
        }
        break;
      }
    }

    if (!placement) {
      break;
    }
  }

  return desired - remainingDesired;
}

function remainingTotal(remainders: StepRemainder[]): number {
  return remainders.reduce((total, item) => total + item.minutes, 0);
}

export function planSchedule(input: ScheduleInput): ScheduleResult {
  const now = input.now.getTime();
  const horizonEnd = input.horizonEnd.getTime();
  const roundedNow = ceilToMinutes(now, 15);
  const days = buildDays(input, roundedNow);
  const blocks: PlannedBlock[] = [];
  const warnings: ScheduleResult["warnings"] = [];
  const assignments = [...input.assignments]
    .map((assignment) => ({
      assignment,
      workingDeadline: workingDeadline(assignment, input.settings, now),
    }))
    .sort(
      (left, right) =>
        left.workingDeadline - right.workingDeadline ||
        WEIGHT_ORDER[left.assignment.weight] -
          WEIGHT_ORDER[right.assignment.weight] ||
        left.assignment.id.localeCompare(right.assignment.id),
    );

  for (const { assignment, workingDeadline: working } of assignments) {
    const remainders = remainingSteps(assignment);
    const sequence = {
      notBefore: roundedNow,
      latestEndByStep: new Map<string, number>(),
    };
    const total = remainingTotal(remainders);

    if (total === 0) {
      continue;
    }

    if (assignment.deadline.getTime() <= now) {
      const today = zonedParts(input.now, APP_TIMEZONE);
      warnings.push({
        assignmentId: assignment.id,
        minutesShort: total,
        firstOverflowDay: dateKey(today),
      });
      continue;
    }

    const cutoff = Math.min(working, horizonEnd);
    const eligibleDays = days.filter(
      (day) => day.dayStart < cutoff && capacityForDay(day, cutoff, input.settings) > 0,
    );

    if (eligibleDays.length > 0) {
      let remainingAtStartOfDay = total;

      for (let index = 0; index < eligibleDays.length && remainders.length; index += 1) {
        const daysLeft = eligibleDays.length - index;
        const evenTarget = roundMinutesUp(
          Math.ceil(remainingAtStartOfDay / daysLeft),
          5,
        );
        const desired = Math.max(
          Math.min(input.settings.min_block_minutes, remainingAtStartOfDay),
          evenTarget,
        );
        const placed = placeMinutes({
          assignment,
          days: [eligibleDays[index]],
          cutoff,
          remainders,
          desired,
          settings: input.settings,
          blocks,
          sequence,
        });
        remainingAtStartOfDay -= placed;
      }

      const leftover = remainingTotal(remainders);

      if (leftover > 0) {
        placeMinutes({
          assignment,
          days: eligibleDays,
          cutoff,
          remainders,
          desired: leftover,
          settings: input.settings,
          blocks,
          sequence,
        });
      }
    }

    const short = remainingTotal(remainders);

    if (short > 0 && working <= horizonEnd) {
      warnings.push({
        assignmentId: assignment.id,
        minutesShort: short,
        firstOverflowDay: dateKey(zonedParts(new Date(working), APP_TIMEZONE)),
      });
    }
  }

  blocks.sort(
    (left, right) =>
      left.start.getTime() - right.start.getTime() ||
      left.stepId.localeCompare(right.stepId),
  );

  return { blocks, warnings };
}
