export const PACE_MIN = 0.5;
export const PACE_MAX = 3.0;

export type PaceSession = {
  actualMinutes: number;
  steps: Array<{
    estimatedMinutes: number;
    before: number;
    after: number;
  }>;
};

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function computePace(sessions: PaceSession[]): number {
  if (sessions.length === 0) {
    return 1;
  }

  let actualMinutes = 0;
  let estimatedProgressMinutes = 0;

  for (const session of sessions) {
    actualMinutes += safeNonNegative(session.actualMinutes);

    for (const step of session.steps) {
      const estimatedMinutes = safeNonNegative(step.estimatedMinutes);
      const before = safeNonNegative(step.before);
      const after = safeNonNegative(step.after);
      const progress = Math.max(0, after - before) / 100;
      estimatedProgressMinutes += estimatedMinutes * progress;
    }
  }

  const ratio = (60 + actualMinutes) / (60 + estimatedProgressMinutes);
  const clamped = Math.min(PACE_MAX, Math.max(PACE_MIN, ratio));

  return Math.round(clamped * 100) / 100;
}

export function describePace(ratio: number): string {
  const safeRatio = Number.isFinite(ratio) && ratio >= 0 ? ratio : 1;
  const formatted = safeRatio.toFixed(2);

  if (safeRatio > 1) {
    const percent = Math.round((safeRatio - 1) * 100);
    return `Pace: ${formatted}× — you take about ${percent}% longer than estimated`;
  }

  if (safeRatio < 1) {
    const percent = Math.round((1 - safeRatio) * 100);
    return `Pace: ${formatted}× — you take about ${percent}% less time than estimated`;
  }

  return `Pace: ${formatted}× — right on your estimates`;
}
