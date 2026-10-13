import { APP_TIMEZONE, zonedParts } from "../time/zoned";

const PERCENT_VALUES = [0, 25, 50, 75, 100] as const;

export type CheckinStepInput = {
  id: string;
  assignmentId: string;
  assignmentStatus: string;
  assignmentTitle: string;
  className: string;
  classColor: string;
  name: string;
  order: number;
  percentDone: number;
};

export type CheckinBlockInput = {
  id: string;
  stepId: string;
  start: string;
  plannedMinutes: number;
  status: string;
};

export type CheckinSessionInput = {
  assignmentId: string;
  actualMinutes: number;
};

export type CheckinGroup = {
  assignmentId: string;
  className: string;
  classColor: string;
  title: string;
  minutesDefault: number;
  blockIds: string[];
  steps: Array<{
    stepId: string;
    name: string;
    order: number;
    storedPercent: number;
    plannedToday: boolean;
  }>;
  alreadyCheckedIn: boolean;
};

type BuildCheckinViewInput = {
  blocks: CheckinBlockInput[];
  steps: CheckinStepInput[];
  sessionsToday: CheckinSessionInput[];
  todayLa: string;
  yesterdayLa: string;
};

function laDateKey(instant: string): string | null {
  const date = new Date(instant);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const parts = zonedParts(date, APP_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(720, Math.max(0, Math.round(value)));
}

export function percentChoices(storedPercent: number) {
  const safeStored = Number.isFinite(storedPercent) ? storedPercent : 0;

  return PERCENT_VALUES.map((value) => ({
    value,
    disabled: value < safeStored,
  }));
}

export function buildCheckinView({
  blocks,
  steps,
  sessionsToday,
  todayLa,
  yesterdayLa,
}: BuildCheckinViewInput): CheckinGroup[] {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const stepsByAssignment = new Map<string, CheckinStepInput[]>();
  const sessionsByAssignment = new Map(
    sessionsToday.map((session) => [session.assignmentId, session]),
  );

  for (const step of steps) {
    const assignmentSteps = stepsByAssignment.get(step.assignmentId) ?? [];
    assignmentSteps.push(step);
    stepsByAssignment.set(step.assignmentId, assignmentSteps);
  }

  const includedBlocks = blocks.flatMap((block) => {
    const step = stepById.get(block.stepId);
    const dateKey = laDateKey(block.start);

    if (!step || step.assignmentStatus !== "active" || !dateKey) {
      return [];
    }

    const plannedOrMissed =
      (block.status === "planned" || block.status === "missed") &&
      (dateKey === yesterdayLa || dateKey === todayLa);
    const checkedInToday =
      block.status === "checked_in" && dateKey === todayLa;

    return plannedOrMissed || checkedInToday
      ? [{ block, step, dateKey, plannedOrMissed, checkedInToday }]
      : [];
  });
  const groups = new Map<string, CheckinGroup>();

  for (const item of includedBlocks) {
    const assignmentId = item.step.assignmentId;
    let group = groups.get(assignmentId);

    if (!group) {
      const assignmentSteps = (stepsByAssignment.get(assignmentId) ?? [])
        .filter(
          (step) =>
            step.assignmentStatus === "active" && step.percentDone < 100,
        )
        .sort((first, second) => first.order - second.order || first.id.localeCompare(second.id));

      group = {
        assignmentId,
        className: item.step.className,
        classColor: item.step.classColor,
        title: item.step.assignmentTitle,
        minutesDefault: 0,
        blockIds: [],
        steps: assignmentSteps.map((step) => ({
          stepId: step.id,
          name: step.name,
          order: step.order,
          storedPercent: step.percentDone,
          plannedToday: false,
        })),
        alreadyCheckedIn: sessionsByAssignment.has(assignmentId),
      };
      groups.set(assignmentId, group);
    }

    const displayedStep = group.steps.find(
      (step) => step.stepId === item.step.id,
    );

    if (displayedStep) {
      displayedStep.plannedToday = true;
    }

    if (item.plannedOrMissed) {
      group.blockIds.push(item.block.id);
      group.minutesDefault += clampMinutes(item.block.plannedMinutes);
    }

    if (item.checkedInToday) {
      group.alreadyCheckedIn = true;
    }
  }

  for (const group of groups.values()) {
    const session = sessionsByAssignment.get(group.assignmentId);

    if (session) {
      group.minutesDefault = clampMinutes(session.actualMinutes);
    } else {
      group.minutesDefault = clampMinutes(group.minutesDefault);
    }
  }

  return [...groups.values()].sort(
    (first, second) =>
      first.className.localeCompare(second.className) ||
      first.title.localeCompare(second.title) ||
      first.assignmentId.localeCompare(second.assignmentId),
  );
}
