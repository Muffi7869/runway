import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { requireOwner } from "@/lib/auth/server";
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
    .select("id,title,status,ai_total_estimate_minutes")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (assignmentError) {
    throw new Error("Unable to load the assignment.");
  }

  if (!assignment || assignment.status !== "active") {
    notFound();
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

  if (stepIds.length > 0) {
    const { data: loggedSteps, error: loggedStepsError } = await supabase
      .from("session_steps")
      .select("step_id")
      .eq("user_id", user.id)
      .in("step_id", stepIds);

    if (loggedStepsError) {
      throw new Error("Unable to load step history.");
    }

    for (const loggedStep of loggedSteps) {
      loggedStepIds.add(loggedStep.step_id);
    }
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
      <h1 className={styles.heading}>{assignment.title}</h1>
      <StepEditor
        assignmentId={assignment.id}
        initialAiTotal={assignment.ai_total_estimate_minutes}
        initialSteps={editorSteps}
      />
      <Link className={styles.backLink} href="/assignments">
        Back to assignments
      </Link>
    </main>
  );
}
