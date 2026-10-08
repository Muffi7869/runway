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
  | { ok: true; steps: DraftStep[]; specWasCut: boolean };

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

  return generateBreakdown({
    className: classRow.name,
    title: assignment.title,
    deadlineIso: assignment.deadline,
    weight: weight.data,
    specText: assignment.spec_text,
  });
}
