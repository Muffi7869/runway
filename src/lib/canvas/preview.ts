import {
  DEFAULT_DEADLINE_TIME,
  formatDeadline,
} from "../assignments/helpers";
import type { ClassMatch } from "./class-match";
import type { CanvasDue, CanvasSkippedCounts } from "./parse";
import type { ImportPlan } from "./plan";
import { isInImportWindow, resolveDueIso } from "./window";

export type CanvasPreviewFreshRow = {
  uid: string;
  title: string;
  defaultTime: string | null;
  dueLabel: string;
  isDateOnly: boolean;
  matchStatus: ClassMatch["status"];
  preselectedClassId: string | null;
};

export type CanvasPreviewChangedRow = {
  uid: string;
  title: string;
  oldDeadlineLabel: string;
  newLabel: string;
};

export type CanvasPreviewAlreadyRow = {
  title: string;
  status: "active" | "done" | "dropped";
  label: string;
};

export type CanvasPreview = {
  fresh: CanvasPreviewFreshRow[];
  changed: CanvasPreviewChangedRow[];
  already: CanvasPreviewAlreadyRow[];
  classes: { id: string; name: string }[];
  skipped: CanvasSkippedCounts & { outsideWindow: number };
};

function dueLabel(due: CanvasDue, now: Date): string {
  return due.kind === "date" ? due.date : formatDeadline(due.iso, now);
}

export function toCanvasPreview(
  plan: ImportPlan,
  skipped: CanvasSkippedCounts,
  classes: { id: string; name: string }[],
  now: Date,
): CanvasPreview {
  return {
    fresh: plan.fresh.map((item) => ({
      uid: item.uid,
      title: item.title,
      defaultTime:
        item.due.kind === "date" ? DEFAULT_DEADLINE_TIME : null,
      dueLabel: dueLabel(item.due, now),
      isDateOnly: item.due.kind === "date",
      matchStatus: item.match.status,
      preselectedClassId:
        item.match.status === "one" ? item.match.classId : null,
    })),
    changed: plan.changed.map((item) => ({
      uid: item.uid,
      title: item.title,
      oldDeadlineLabel: formatDeadline(item.oldDeadline, now),
      newLabel: dueLabel(item.newDue, now),
    })),
    already: plan.already.map((item) => ({
      title: item.title,
      status: item.status,
      label: formatDeadline(item.deadline, now),
    })),
    classes,
    skipped: { ...skipped, outsideWindow: plan.outsideWindow },
  };
}

export function freshRowAvailability(
  row: Pick<CanvasPreviewFreshRow, "isDateOnly" | "dueLabel">,
  classId: string,
  time: string,
  now: Date,
): { importable: true } | { importable: false; message: string } {
  if (!classId) {
    return { importable: false, message: "Choose a class" };
  }

  if (!row.isDateOnly) {
    return { importable: true };
  }

  const resolved = resolveDueIso(
    { kind: "date", date: row.dueLabel },
    time,
  );

  if (!resolved.ok || !isInImportWindow(resolved.iso, now)) {
    return {
      importable: false,
      message: "Past or outside the import window",
    };
  }

  return { importable: true };
}
