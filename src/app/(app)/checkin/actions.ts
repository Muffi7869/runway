"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireOwner } from "@/lib/auth/server";
import { mapCheckinError } from "@/lib/checkin/errors";
import type { Database, Json } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { computePace } from "@/lib/pace/compute";
import { buildPaceSessions } from "@/lib/pace/input";
import { replan } from "@/lib/scheduler/replan";

const MAX_JSON_LENGTH = 20_000;
const percentSchema = z.union([
  z.literal(0),
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(100),
]);
const entrySchema = z.object({
  assignment_id: z.string().uuid(),
  actual_minutes: z.number().int().min(0).max(720),
  steps: z
    .array(
      z.object({
        step_id: z.string().uuid(),
        percent_after: percentSchema,
      }),
    )
    .max(50),
});
const entriesSchema = z
  .array(entrySchema)
  .min(1)
  .max(50)
  .superRefine((entries, context) => {
    const assignmentIds = new Set<string>();
    const stepIds = new Set<string>();

    for (const entry of entries) {
      if (assignmentIds.has(entry.assignment_id)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate assignment.",
        });
      }
      assignmentIds.add(entry.assignment_id);

      for (const step of entry.steps) {
        if (stepIds.has(step.step_id)) {
          context.addIssue({ code: "custom", message: "Duplicate step." });
        }
        stepIds.add(step.step_id);
      }
    }
  });
const blockIdsSchema = z.array(z.string().uuid()).max(500);
const resultSchema = z.object({
  session_date: z.string(),
  assignment_ids: z.array(z.string().uuid()),
  class_ids: z.array(z.string().uuid()),
});

export type CheckinActionState = {
  ok?: boolean;
  error?: string;
  allDone?: Array<{ assignmentId: string; title: string }>;
  paceFailed?: boolean;
  replanFailed?: boolean;
};

function formText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function parseJsonField(formData: FormData, name: string): unknown {
  const value = formText(formData, name);

  if (value === null || value.length > MAX_JSON_LENGTH) {
    throw new Error("invalid input");
  }

  return JSON.parse(value) as unknown;
}

async function updateClassPace(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  classId: string,
): Promise<boolean> {
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id,status")
    .eq("user_id", ownerId)
    .eq("class_id", classId);

  if (assignmentsError) {
    return false;
  }

  const assignmentIds = assignments.map((assignment) => assignment.id);
  let sessionRows: Array<{
    id: string;
    assignment_id: string;
    actual_minutes: number;
  }> = [];

  if (assignmentIds.length > 0) {
    const { data, error } = await supabase
      .from("sessions")
      .select("id,assignment_id,actual_minutes")
      .eq("user_id", ownerId)
      .in("assignment_id", assignmentIds);

    if (error) {
      return false;
    }
    sessionRows = data;
  }

  const sessionIds = sessionRows.map((session) => session.id);
  let progressRows: Array<{
    session_id: string;
    step_id: string;
    percent_before: number;
    percent_after: number;
  }> = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("session_steps")
      .select("session_id,step_id,percent_before,percent_after")
      .eq("user_id", ownerId)
      .in("session_id", sessionIds);

    if (error) {
      return false;
    }
    progressRows = data;
  }

  const stepIds = [...new Set(progressRows.map((row) => row.step_id))];
  let stepRows: Array<{ id: string; estimated_minutes: number }> = [];

  if (stepIds.length > 0) {
    const { data, error } = await supabase
      .from("steps")
      .select("id,estimated_minutes")
      .eq("user_id", ownerId)
      .in("id", stepIds);

    if (error) {
      return false;
    }
    stepRows = data;
  }

  const statusByAssignment = new Map(
    assignments.map((assignment) => [assignment.id, assignment.status]),
  );
  const pace = computePace(
    buildPaceSessions({
      sessions: sessionRows.map((session) => ({
        id: session.id,
        actualMinutes: session.actual_minutes,
        assignmentStatus:
          statusByAssignment.get(session.assignment_id) ?? "unknown",
      })),
      sessionSteps: progressRows.map((row) => ({
        sessionId: row.session_id,
        stepId: row.step_id,
        before: row.percent_before,
        after: row.percent_after,
      })),
      steps: stepRows.map((step) => ({
        id: step.id,
        estimatedMinutes: step.estimated_minutes,
      })),
    }),
  );
  const { error: updateError } = await supabase
    .from("classes")
    .update({ pace_ratio: pace })
    .eq("id", classId)
    .eq("user_id", ownerId);

  return !updateError;
}

export async function saveCheckinAction(
  _previousState: CheckinActionState,
  formData: FormData,
): Promise<CheckinActionState> {
  const user = await requireOwner();
  let parsedEntries: z.infer<typeof entriesSchema>;
  let parsedBlockIds: z.infer<typeof blockIdsSchema>;

  try {
    parsedEntries = entriesSchema.parse(parseJsonField(formData, "entries"));
    parsedBlockIds = blockIdsSchema.parse(
      parseJsonField(formData, "blockIds"),
    );
  } catch {
    return {
      error: "Couldn't save the check-in. Check the values and try again.",
    };
  }

  const supabase = await createClient();
  const submittedSteps = parsedEntries.flatMap((entry) =>
    entry.steps.map((step) => ({ ...step, assignmentId: entry.assignment_id })),
  );
  const submittedStepIds = submittedSteps.map((step) => step.step_id);
  const storedPercentByStep = new Map<
    string,
    { assignmentId: string; percent: number }
  >();

  if (submittedStepIds.length > 0) {
    const { data: storedSteps, error: storedStepsError } = await supabase
      .from("steps")
      .select("id,assignment_id,percent_done")
      .eq("user_id", user.id)
      .in("id", submittedStepIds);

    if (storedStepsError || storedSteps.length !== submittedStepIds.length) {
      return { error: "Something changed. Refresh the page and try again." };
    }

    for (const step of storedSteps) {
      storedPercentByStep.set(step.id, {
        assignmentId: step.assignment_id,
        percent: step.percent_done,
      });
    }
  }

  const filteredEntries = parsedEntries.map((entry) => ({
    ...entry,
    steps: entry.steps.filter((step) => {
      const stored = storedPercentByStep.get(step.step_id);
      return (
        stored?.assignmentId === entry.assignment_id &&
        step.percent_after > stored.percent
      );
    }),
  }));

  if (
    submittedSteps.some((step) => {
      const stored = storedPercentByStep.get(step.step_id);
      return !stored || stored.assignmentId !== step.assignmentId;
    })
  ) {
    return { error: "Something changed. Refresh the page and try again." };
  }

  const { data: rawResult, error: saveError } = await supabase.rpc(
    "save_checkin",
    {
      p_entries: filteredEntries as Json,
      p_block_ids: parsedBlockIds,
    },
  );

  if (saveError) {
    return { error: mapCheckinError(saveError) };
  }

  const result = resultSchema.safeParse(rawResult);

  if (!result.success) {
    return {
      error: "Couldn't save the check-in. Check the values and try again.",
    };
  }

  const paceResults = await Promise.all(
    result.data.class_ids.map((classId) =>
      updateClassPace(supabase, user.id, classId),
    ),
  );
  let replanFailed = false;

  try {
    const planResult = await replan(supabase, user.id);
    replanFailed = !planResult.ok;
  } catch {
    replanFailed = true;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id,title,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("id", result.data.assignment_ids);
  const { data: steps, error: stepsError } = await supabase
    .from("steps")
    .select("assignment_id,percent_done")
    .eq("user_id", user.id)
    .in("assignment_id", result.data.assignment_ids);
  const allDone =
    assignmentsError || stepsError
      ? []
      : assignments.flatMap((assignment) => {
          const assignmentSteps = steps.filter(
            (step) => step.assignment_id === assignment.id,
          );
          return assignmentSteps.length > 0 &&
            assignmentSteps.every((step) => step.percent_done === 100)
            ? [{ assignmentId: assignment.id, title: assignment.title }]
            : [];
        });

  revalidatePath("/checkin");
  revalidatePath("/classes");
  revalidatePath("/week");
  revalidatePath("/assignments");

  return {
    ok: true,
    allDone,
    paceFailed: paceResults.some((updated) => !updated),
    replanFailed,
  };
}
