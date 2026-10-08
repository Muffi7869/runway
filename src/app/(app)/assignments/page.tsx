import Link from "next/link";

import {
  formatDeadline,
  formatEstimate,
  splitAssignments,
} from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { CLASS_COLOR_PALETTE } from "@/lib/classes/palette";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";
import { currentTotalsByAssignment } from "@/lib/steps/totals";

import styles from "./assignments.module.css";
import { AssignmentStatusButton } from "./status-button";

type AssignmentRow = {
  id: string;
  class_id: string;
  title: string;
  deadline: string;
  weight: "low" | "medium" | "high";
  status: "active" | "done" | "dropped";
};

type ClassRow = {
  id: string;
  name: string;
  color: string;
};

const assignmentStatuses = ["active", "done", "dropped"] as const;
const assignmentWeights = ["low", "medium", "high"] as const;

function isAssignmentRow(value: {
  id: string;
  class_id: string;
  title: string;
  deadline: string;
  weight: string;
  status: string;
}): value is AssignmentRow {
  return (
    assignmentStatuses.includes(
      value.status as (typeof assignmentStatuses)[number],
    ) &&
    assignmentWeights.includes(
      value.weight as (typeof assignmentWeights)[number],
    )
  );
}

function paletteValue(colorKey: string): string {
  return (
    CLASS_COLOR_PALETTE.find((color) => color.key === colorKey)?.value ??
    "#737373"
  );
}

function AssignmentRows({
  assignments,
  classesById,
  currentTotals,
  now,
  variant,
}: {
  assignments: AssignmentRow[];
  classesById: Map<string, ClassRow>;
  currentTotals: Map<string, number>;
  now: Date;
  variant: "active" | "done" | "dropped";
}) {
  return (
    <div className={styles.list}>
      {assignments.map((assignment) => {
        const classRow = classesById.get(assignment.class_id);
        const currentTotal = currentTotals.get(assignment.id);

        return (
          <article className={styles.row} key={assignment.id}>
            <div className={styles.content}>
              <div className={styles.className}>
                <span
                  aria-hidden="true"
                  className={styles.swatch}
                  style={{
                    backgroundColor: paletteValue(classRow?.color ?? ""),
                  }}
                />
                <span>{classRow?.name ?? "Unknown class"}</span>
              </div>

              <h3 className={styles.title}>{assignment.title}</h3>

              <div className={styles.facts}>
                <span>Due {formatDeadline(assignment.deadline, now)}</span>
                <span>Weight: {assignment.weight}</span>
                <span>
                  Total:{" "}
                  {currentTotal === undefined
                    ? "Not broken down yet"
                    : formatEstimate(currentTotal)}
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              {variant === "active" ? (
                <>
                  <Link
                    className={styles.linkButton}
                    href={`/assignments/${assignment.id}/breakdown`}
                  >
                    Break down
                  </Link>
                  <Link
                    className={styles.linkButton}
                    href={`/assignments/${assignment.id}/edit`}
                  >
                    Edit
                  </Link>
                  <AssignmentStatusButton
                    assignmentId={assignment.id}
                    kind="done"
                  />
                  <AssignmentStatusButton
                    assignmentId={assignment.id}
                    kind="drop"
                  />
                </>
              ) : (
                <AssignmentStatusButton
                  assignmentId={assignment.id}
                  kind="restore"
                />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default async function AssignmentsPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const [classesResult, assignmentsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name,color")
      .eq("user_id", user.id),
    supabase
      .from("assignments")
      .select("id,class_id,title,deadline,weight,status")
      .eq("user_id", user.id),
  ]);

  if (classesResult.error || assignmentsResult.error) {
    throw new Error("Unable to load assignments.");
  }

  if (!assignmentsResult.data.every(isAssignmentRow)) {
    throw new Error("An assignment has an unsupported status or weight.");
  }

  const assignmentIds = assignmentsResult.data.map((assignment) => assignment.id);
  let stepRows: { assignment_id: string; estimated_minutes: number }[] = [];

  if (assignmentIds.length > 0) {
    const { data, error } = await supabase
      .from("steps")
      .select("assignment_id,estimated_minutes")
      .eq("user_id", user.id)
      .in("assignment_id", assignmentIds);

    if (error) {
      throw new Error("Unable to load assignment totals.");
    }

    stepRows = data;
  }

  const classesById = new Map(
    classesResult.data.map((classRow) => [classRow.id, classRow]),
  );
  const assignments = splitAssignments(assignmentsResult.data);
  const currentTotals = currentTotalsByAssignment(stepRows);
  const now = new Date();

  return (
    <main className={styles.page}>
      <div className={styles.headingRow}>
        <h1 className={styles.heading}>Assignments</h1>
        <Link className={styles.addLink} href="/assignments/new">
          Add assignment
        </Link>
      </div>

      <section aria-labelledby="active-assignments" className={styles.section}>
        <h2 className={styles.sectionHeading} id="active-assignments">
          Active
        </h2>
        {assignments.active.length ? (
          <AssignmentRows
            assignments={assignments.active}
            classesById={classesById}
            currentTotals={currentTotals}
            now={now}
            variant="active"
          />
        ) : (
          <p>No active assignments yet.</p>
        )}
      </section>

      <details className={styles.details}>
        <summary className={styles.summary}>
          Done ({assignments.done.length})
        </summary>
        {assignments.done.length ? (
          <AssignmentRows
            assignments={assignments.done}
            classesById={classesById}
            currentTotals={currentTotals}
            now={now}
            variant="done"
          />
        ) : (
          <p className={styles.emptyDetails}>No done assignments.</p>
        )}
      </details>

      <details className={styles.details}>
        <summary className={styles.summary}>
          Dropped ({assignments.dropped.length})
        </summary>
        {assignments.dropped.length ? (
          <AssignmentRows
            assignments={assignments.dropped}
            classesById={classesById}
            currentTotals={currentTotals}
            now={now}
            variant="dropped"
          />
        ) : (
          <p className={styles.emptyDetails}>No dropped assignments.</p>
        )}
      </details>
    </main>
  );
}
