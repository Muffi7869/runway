import { APP_TIMEZONE, zonedParts } from "../time/zoned";
import { matchClass, type ClassMatch } from "./class-match";
import type { CanvasDue, CanvasFeedItem } from "./parse";
import { isInImportWindow, resolveDueIso } from "./window";

type ExistingAssignment = {
  id: string;
  canvas_uid: string;
  deadline: string;
  status: "active" | "done" | "dropped";
  title: string;
};

type FreshImport = {
  uid: string;
  title: string;
  bracketText: string;
  due: CanvasDue;
  defaultDueIso: string;
  match: ClassMatch;
};

type ChangedImport = {
  id: string;
  uid: string;
  title: string;
  oldDeadline: string;
  newDue: CanvasDue;
};

type AlreadyImported = {
  id: string;
  uid: string;
  title: string;
  status: "active" | "done" | "dropped";
};

export type ImportPlan = {
  fresh: FreshImport[];
  changed: ChangedImport[];
  already: AlreadyImported[];
  outsideWindow: number;
};

function losAngelesDate(iso: string): string | null {
  const instant = new Date(iso);

  if (!Number.isFinite(instant.getTime())) {
    return null;
  }

  const parts = zonedParts(instant, APP_TIMEZONE);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}`;
}

function deadlineMatches(
  due: CanvasDue,
  resolvedIso: string,
  existingDeadline: string,
): boolean {
  if (due.kind === "date") {
    return losAngelesDate(existingDeadline) === due.date;
  }

  return new Date(existingDeadline).getTime() === new Date(resolvedIso).getTime();
}

export function planImport(
  items: CanvasFeedItem[],
  existing: ExistingAssignment[],
  classes: { id: string; name: string }[],
  now: Date,
): ImportPlan {
  const existingByUid = new Map(
    existing.map((assignment) => [assignment.canvas_uid, assignment]),
  );
  const plan: ImportPlan = {
    fresh: [],
    changed: [],
    already: [],
    outsideWindow: 0,
  };

  for (const item of items) {
    const resolved = resolveDueIso(item.due);

    if (!resolved.ok || !isInImportWindow(resolved.iso, now)) {
      plan.outsideWindow += 1;
      continue;
    }

    const stored = existingByUid.get(item.uid);

    if (!stored) {
      plan.fresh.push({
        uid: item.uid,
        title: item.title,
        bracketText: item.bracketText,
        due: item.due,
        defaultDueIso: resolved.iso,
        match: matchClass(item.bracketText, classes),
      });
      continue;
    }

    if (
      stored.status !== "active" ||
      deadlineMatches(item.due, resolved.iso, stored.deadline)
    ) {
      plan.already.push({
        id: stored.id,
        uid: item.uid,
        title: item.title,
        status: stored.status,
      });
      continue;
    }

    plan.changed.push({
      id: stored.id,
      uid: item.uid,
      title: item.title,
      oldDeadline: stored.deadline,
      newDue: item.due,
    });
  }

  return plan;
}
