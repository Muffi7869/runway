import type { PaceSession } from "./compute";

export type PaceSessionRow = {
  id: string;
  actualMinutes: number;
  assignmentStatus: string;
};

export type PaceSessionStepRow = {
  sessionId: string;
  stepId: string;
  before: number;
  after: number;
};

export type PaceStepRow = {
  id: string;
  estimatedMinutes: number;
};

export function buildPaceSessions({
  sessions,
  sessionSteps,
  steps,
}: {
  sessions: PaceSessionRow[];
  sessionSteps: PaceSessionStepRow[];
  steps: PaceStepRow[];
}): PaceSession[] {
  const estimateByStep = new Map(
    steps.map((step) => [step.id, step.estimatedMinutes]),
  );
  const progressBySession = new Map<string, PaceSession["steps"]>();

  for (const sessionStep of sessionSteps) {
    const estimatedMinutes = estimateByStep.get(sessionStep.stepId);

    if (estimatedMinutes === undefined) {
      continue;
    }

    const progress = progressBySession.get(sessionStep.sessionId) ?? [];
    progress.push({
      estimatedMinutes,
      before: sessionStep.before,
      after: sessionStep.after,
    });
    progressBySession.set(sessionStep.sessionId, progress);
  }

  return sessions.map((session) => ({
    actualMinutes: session.actualMinutes,
    steps: progressBySession.get(session.id) ?? [],
  }));
}
