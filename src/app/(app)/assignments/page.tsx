import Link from "next/link";

import { formatDeadline, splitAssignments } from "@/lib/assignments/helpers";
import { shouldShowNeedsSpec } from "@/lib/assignments/needs-spec";
import { groupByWeek } from "@/lib/assignments/presentation";
import { requireOwner } from "@/lib/auth/server";
import { CLASS_COLOR_PALETTE, type ClassColor } from "@/lib/classes/palette";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";
import { currentTotalsByAssignment, describeTotalParts } from "@/lib/steps/totals";
import { assignmentProgress } from "@/lib/week/presentation";

import styles from "./assignments.module.css";
import { AssignmentsView, type AssignmentListItem } from "./assignments-view";

type AssignmentRow = {
  id: string; class_id: string; title: string; deadline: string;
  weight: "low" | "medium" | "high"; status: "active" | "done" | "dropped";
  ai_total_estimate_minutes: number | null;
};
const statuses = ["active", "done", "dropped"] as const;
const weights = ["low", "medium", "high"] as const;

function isAssignmentRow(value: Omit<AssignmentRow, "weight" | "status"> & { weight: string; status: string }): value is AssignmentRow {
  return statuses.includes(value.status as AssignmentRow["status"]) && weights.includes(value.weight as AssignmentRow["weight"]);
}

function colorKey(value?: string): ClassColor {
  return CLASS_COLOR_PALETTE.some((color) => color.key === value) ? value as ClassColor : "blue";
}

export default async function AssignmentsPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const [classesResult, assignmentsResult] = await Promise.all([
    supabase.from("classes").select("id,name,color").eq("user_id", user.id),
    supabase.from("assignments").select("id,class_id,title,deadline,weight,status,ai_total_estimate_minutes").eq("user_id", user.id),
  ]);
  if (classesResult.error || assignmentsResult.error) throw new Error("Unable to load assignments.");
  if (!assignmentsResult.data.every(isAssignmentRow)) throw new Error("An assignment has an unsupported status or weight.");

  const assignmentIds = assignmentsResult.data.map(({ id }) => id);
  let steps: { assignment_id: string; estimated_minutes: number; percent_done: number }[] = [];
  let needsSpecRows: { id: string }[] = [];
  if (assignmentIds.length) {
    const [stepsResult, needsSpecResult] = await Promise.all([
      supabase.from("steps").select("assignment_id,estimated_minutes,percent_done").eq("user_id", user.id).in("assignment_id", assignmentIds),
      supabase.from("assignments").select("id").eq("user_id", user.id).eq("status", "active").in("id", assignmentIds).is("spec_text", null),
    ]);
    if (stepsResult.error || needsSpecResult.error) throw new Error("Unable to load assignment details.");
    steps = stepsResult.data;
    needsSpecRows = needsSpecResult.data;
  }

  const now = new Date();
  const classesById = new Map(classesResult.data.map((row) => [row.id, row]));
  const needsSpecIds = new Set(needsSpecRows.map(({ id }) => id));
  const totals = currentTotalsByAssignment(steps);
  const stepsByAssignment = new Map<string, typeof steps>();
  for (const step of steps) stepsByAssignment.set(step.assignment_id, [...(stepsByAssignment.get(step.assignment_id) ?? []), step]);

  function present(assignment: AssignmentRow): AssignmentListItem {
    const classRow = classesById.get(assignment.class_id);
    const assignmentSteps = stepsByAssignment.get(assignment.id) ?? [];
    const total = totals.get(assignment.id);
    const totalLabels = describeTotalParts({ aiTotal: assignment.ai_total_estimate_minutes, currentTotal: total ?? null });
    return {
      id: assignment.id, title: assignment.title,
      className: classRow?.name ?? "Unknown class", classColor: colorKey(classRow?.color),
      deadlineLabel: formatDeadline(assignment.deadline, now), weight: assignment.weight, status: assignment.status,
      progress: assignmentProgress(assignmentSteps),
      currentTotal: totalLabels.currentText === "not set yet" ? "Not planned" : totalLabels.currentText,
      aiTotal: totalLabels.aiText ?? undefined,
      needsSpec: shouldShowNeedsSpec(assignment, needsSpecIds),
      overdue: assignment.status === "active" && new Date(assignment.deadline) < now,
      weekGroup: "later", hasSteps: assignmentSteps.length > 0,
    };
  }

  const split = splitAssignments(assignmentsResult.data);
  const grouped = groupByWeek(split.active, now);
  return <main className={styles.page}>
    <div className={styles.headingRow}>
      <div><p className={styles.eyebrow}>Plan your work</p><h1 className={styles.heading}>Assignments</h1></div>
      <div className={styles.headingActions}>
        <Link className="ui-button" href="/assignments/import">Import from Canvas</Link>
        <Link className="ui-button ui-button--primary" href="/assignments/new">Add assignment</Link>
      </div>
    </div>
    <AssignmentsView
      activeGroups={{ thisWeek: grouped.thisWeek.map(present), nextWeek: grouped.nextWeek.map(present), later: grouped.later.map(present) }}
      done={split.done.map(present)} dropped={split.dropped.map(present)}
    />
  </main>;
}
