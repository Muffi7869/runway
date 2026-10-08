import type { DraftStep } from "../ai/breakdown";

import {
  DEFAULT_NEW_STEP_MINUTES,
  MAX_EDITOR_STEPS,
  MAX_STEP_MINUTES,
  MAX_STEP_NAME,
  MIN_EDITOR_STEPS,
  MIN_STEP_MINUTES,
  STEP_LOGGED_WORK_MESSAGE,
  STEP_MINUTES_INCREMENT,
} from "./limits";

export type EditorStep = {
  key: string;
  id: string | null;
  name: string;
  minutes: number;
  percentDone: number;
  hasLoggedWork: boolean;
};

export type StepFieldErrors = Record<
  string,
  { name?: string; minutes?: string }
>;

export type EditorValidationResult =
  | { ok: true }
  | { ok: false; listError?: string; stepErrors: StepFieldErrors };

type NewStepValues = Partial<Omit<EditorStep, "key">>;

export function makeStep(partial: NewStepValues = {}): EditorStep {
  return {
    key: globalThis.crypto.randomUUID(),
    id: null,
    name: "",
    minutes: DEFAULT_NEW_STEP_MINUTES,
    percentDone: 0,
    hasLoggedWork: false,
    ...partial,
  };
}

export function addStep(steps: EditorStep[]): EditorStep[] {
  return steps.length >= MAX_EDITOR_STEPS ? [...steps] : [...steps, makeStep()];
}

export function removeStep(
  steps: EditorStep[],
  key: string,
):
  | { ok: true; steps: EditorStep[] }
  | { ok: false; error: string } {
  const step = steps.find((candidate) => candidate.key === key);

  if (step?.hasLoggedWork) {
    return { ok: false, error: STEP_LOGGED_WORK_MESSAGE };
  }

  return {
    ok: true,
    steps: steps.filter((candidate) => candidate.key !== key),
  };
}

export function moveStep(
  steps: EditorStep[],
  key: string,
  direction: "up" | "down",
): EditorStep[] {
  const currentIndex = steps.findIndex((step) => step.key === key);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex < 0 ||
    nextIndex < 0 ||
    nextIndex >= steps.length
  ) {
    return [...steps];
  }

  const result = [...steps];
  [result[currentIndex], result[nextIndex]] = [
    result[nextIndex],
    result[currentIndex],
  ];
  return result;
}

export function renameStep(
  steps: EditorStep[],
  key: string,
  name: string,
): EditorStep[] {
  return steps.map((step) =>
    step.key === key ? { ...step, name } : { ...step },
  );
}

export function setMinutes(
  steps: EditorStep[],
  key: string,
  minutes: number,
): EditorStep[] {
  return steps.map((step) =>
    step.key === key ? { ...step, minutes } : { ...step },
  );
}

export function nudgeMinutes(
  steps: EditorStep[],
  key: string,
  direction: 1 | -1,
): EditorStep[] {
  return steps.map((step) => {
    if (step.key !== key) {
      return { ...step };
    }

    const nextMinutes = step.minutes + direction * STEP_MINUTES_INCREMENT;
    return {
      ...step,
      minutes: Math.min(
        MAX_STEP_MINUTES,
        Math.max(MIN_STEP_MINUTES, nextMinutes),
      ),
    };
  });
}

export function validateEditorSteps(
  steps: EditorStep[],
): EditorValidationResult {
  let listError: string | undefined;

  if (steps.length < MIN_EDITOR_STEPS) {
    listError = "Add at least one step.";
  } else if (steps.length > MAX_EDITOR_STEPS) {
    listError = "A breakdown can have at most 20 steps.";
  }

  const stepErrors: StepFieldErrors = {};

  for (const step of steps) {
    const errors: { name?: string; minutes?: string } = {};
    const trimmedName = step.name.trim();

    if (!trimmedName) {
      errors.name = "Enter a name for this step.";
    } else if (trimmedName.length > MAX_STEP_NAME) {
      errors.name = "Step names must be 60 characters or fewer.";
    }

    if (
      !Number.isInteger(step.minutes) ||
      step.minutes < MIN_STEP_MINUTES ||
      step.minutes > MAX_STEP_MINUTES ||
      step.minutes % STEP_MINUTES_INCREMENT !== 0
    ) {
      errors.minutes = "Minutes must be 15 to 600, in steps of 5.";
    }

    if (errors.name || errors.minutes) {
      stepErrors[step.key] = errors;
    }
  }

  return listError || Object.keys(stepErrors).length > 0
    ? { ok: false, listError, stepErrors }
    : { ok: true };
}

export function sumMinutes(steps: EditorStep[]): number {
  return steps.reduce(
    (total, step) =>
      Number.isFinite(step.minutes) ? total + step.minutes : total,
    0,
  );
}

export function hasProgress(steps: EditorStep[]): boolean {
  return steps.some((step) => step.percentDone > 0 || step.hasLoggedWork);
}

export function toSavePayload(steps: EditorStep[]): Array<{
  id: string | null;
  name: string;
  estimated_minutes: number;
}> {
  return steps.map((step) => ({
    id: step.id,
    name: step.name.trim(),
    estimated_minutes: step.minutes,
  }));
}

export function fromDraft(draftSteps: DraftStep[]): EditorStep[] {
  return draftSteps.map((step) =>
    makeStep({ name: step.name, minutes: step.estimatedMinutes }),
  );
}
