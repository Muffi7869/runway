"use server";

import { z } from "zod";

import {
  generateBreakdown,
  type DraftStep,
} from "@/lib/ai/breakdown";
import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";

const assignmentIdSchema = z.string().uuid();
const assignmentWeightSchema = z.enum(["low", "medium", "high"]);
const unavailableError = "This assignment can't be broken down.";

export type BreakdownActionState =
  | { ok?: false; error?: string }
  | {
      ok: true;
      steps: DraftStep[];
      specWasCut: boolean;
      aiTotalMinutes: number;
    };

export async function generateBreakdownAction(
  _previousState: BreakdownActionState,
  formData: FormData,
): Promise<BreakdownActionState> {
  const user = await requireOwner();
  const assignmentId = assignmentIdSchema.safeParse(
    formData.get("assignmentId"),
  );

  if (!assignmentId.success) {
    return { ok: false, error: unavailableError };
  }

  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id,class_id,title,deadline,weight,spec_text,status")
    .eq("id", assignmentId.data)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (assignmentError) {
    return {
      ok: false,
      error: "Couldn't break this down right now. Try again in a moment.",
    };
  }

  if (!assignment) {
    return { ok: false, error: unavailableError };
  }

  const { data: savedSteps, error: stepsError } = await supabase
    .from("steps")
    .select("id,percent_done")
    .eq("assignment_id", assignment.id)
    .eq("user_id", user.id);

  if (stepsError) {
    return {
      ok: false,
      error: "Couldn't break this down right now. Try again in a moment.",
    };
  }

  const stepIds = savedSteps.map((step) => step.id);
  let hasLoggedWork = false;

  if (stepIds.length > 0) {
    const { data: loggedSteps, error: loggedStepsError } = await supabase
      .from("session_steps")
      .select("step_id")
      .eq("user_id", user.id)
      .in("step_id", stepIds)
      .limit(1);

    if (loggedStepsError) {
      return {
        ok: false,
        error: "Couldn't break this down right now. Try again in a moment.",
      };
    }

    hasLoggedWork = loggedSteps.length > 0;
  }

  if (
    hasLoggedWork ||
    savedSteps.some((step) => step.percent_done > 0)
  ) {
    return {
      ok: false,
      error: "This breakdown already has progress, so it can't be regenerated.",
    };
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id,name")
    .eq("id", assignment.class_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (classError) {
    return {
      ok: false,
      error: "Couldn't break this down right now. Try again in a moment.",
    };
  }

  if (!classRow) {
    return { ok: false, error: unavailableError };
  }

  const weight = assignmentWeightSchema.safeParse(assignment.weight);

  if (!weight.success) {
    return { ok: false, error: unavailableError };
  }

  const result = await generateBreakdown({
    className: classRow.name,
    title: assignment.title,
    deadlineIso: assignment.deadline,
    weight: weight.data,
    specText: assignment.spec_text,
  });

  return result.ok
    ? {
        ...result,
        aiTotalMinutes: result.steps.reduce(
          (total, step) => total + step.estimatedMinutes,
          0,
        ),
      }
    : result;
}
