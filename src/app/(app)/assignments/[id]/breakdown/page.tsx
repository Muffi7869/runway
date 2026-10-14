import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ClassChip } from "@/components/ui/class-chip";
import { formatDeadline } from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { CLASS_COLOR_PALETTE, type ClassColor } from "@/lib/classes/palette";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import type { EditorStep } from "@/lib/steps/editor";

import styles from "./breakdown.module.css";
import { StepEditor } from "./step-editor";

export const maxDuration = 60;

const assignmentIdSchema = z.string().uuid();

export default async function AssignmentBreakdownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSettingsComplete();
  const user = await requireOwner();
  const { id } = await params;

  if (!assignmentIdSchema.safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id,class_id,title,deadline,weight,status,ai_total_estimate_minutes")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (assignmentError) {
    throw new Error("Unable to load the assignment.");
  }

  if (!assignment || assignment.status !== "active") {
    notFound();
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id,name,color")
    .eq("id", assignment.class_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    throw new Error("Unable to load the assignment class.");
  }

  const { data: savedSteps, error: stepsError } = await supabase
    .from("steps")
    .select("id,name,order,estimated_minutes,percent_done")
    .eq("assignment_id", assignment.id)
    .eq("user_id", user.id)
    .order("order", { ascending: true });

  if (stepsError) {
    throw new Error("Unable to load the assignment steps.");
  }

  const stepIds = savedSteps.map((step) => step.id);
  const loggedStepIds = new Set<string>();
  let hasScheduledBlocks = false;

  if (stepIds.length > 0) {
    const [loggedStepsResult, scheduledStepsResult] = await Promise.all([
      supabase
        .from("session_steps")
        .select("step_id")
        .eq("user_id", user.id)
        .in("step_id", stepIds),
      supabase
        .from("blocks")
        .select("step_id")
        .eq("user_id", user.id)
        .in("step_id", stepIds)
        .limit(1),
    ]);

    if (loggedStepsResult.error || scheduledStepsResult.error) {
      throw new Error("Unable to load step history.");
    }

    for (const loggedStep of loggedStepsResult.data) {
      loggedStepIds.add(loggedStep.step_id);
    }

    hasScheduledBlocks = scheduledStepsResult.data.length > 0;
  }

  const editorSteps: EditorStep[] = savedSteps.map((step) => ({
    key: step.id,
    id: step.id,
    name: step.name,
    minutes: step.estimated_minutes,
    percentDone: step.percent_done,
    hasLoggedWork: loggedStepIds.has(step.id),
  }));

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/assignments">Assignments</Link><span aria-hidden="true">/</span><span>Plan</span>
      </nav>
      <header className={styles.pageHeader}>
        <div>
          <ClassChip color={(CLASS_COLOR_PALETTE.some(({ key }) => key === classRow.color) ? classRow.color : "blue") as ClassColor}>{classRow.name}</ClassChip>
          <h1 className={styles.heading}>{assignment.title}</h1>
          <p className={styles.meta}>Due {formatDeadline(assignment.deadline, new Date())} · {assignment.weight} weight</p>
        </div>
        <Link className="ui-button" href={`/assignments/${assignment.id}/edit`}>Edit assignment</Link>
      </header>
      <StepEditor
        assignmentId={assignment.id}
        hasScheduledBlocks={hasScheduledBlocks}
        initialAiTotal={assignment.ai_total_estimate_minutes}
        initialSteps={editorSteps}
      />
    </main>
  );
}
