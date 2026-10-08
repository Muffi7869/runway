"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import {
  validateEditorSteps,
  type EditorStep,
} from "@/lib/steps/editor";
import { mapSaveStepsError } from "@/lib/steps/save-errors";

const MAX_STEPS_JSON_CHARS = 100_000;
const assignmentIdSchema = z.string().uuid();
const stepPayloadSchema = z
  .array(
    z
      .object({
        id: z.string().uuid().nullable(),
        name: z.string(),
        estimated_minutes: z.number(),
      })
      .strict(),
  );

export type SaveStepsActionState = {
  error?: string;
};

const invalidStepsError = "Couldn't save the steps. Check them and try again.";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveStepsAction(
  _previousState: SaveStepsActionState,
  formData: FormData,
): Promise<SaveStepsActionState> {
  await requireOwner();
  const assignmentId = assignmentIdSchema.safeParse(
    textValue(formData, "assignmentId"),
  );
  const rawSteps = textValue(formData, "steps");
  const rawAiTotal = textValue(formData, "aiTotal");

  if (!assignmentId.success || rawSteps.length > MAX_STEPS_JSON_CHARS) {
    return { error: invalidStepsError };
  }

  let decodedSteps: unknown;

  try {
    decodedSteps = JSON.parse(rawSteps);
  } catch {
    return { error: invalidStepsError };
  }

  const parsedSteps = stepPayloadSchema.safeParse(decodedSteps);

  if (!parsedSteps.success) {
    return { error: invalidStepsError };
  }

  const editorSteps: EditorStep[] = parsedSteps.data.map((step, index) => ({
    key: String(index + 1),
    id: step.id,
    name: step.name,
    minutes: step.estimated_minutes,
    percentDone: 0,
    hasLoggedWork: false,
  }));
  const validation = validateEditorSteps(editorSteps);

  if (!validation.ok) {
    return { error: invalidStepsError };
  }

  let aiTotal: number | undefined;

  if (rawAiTotal !== "") {
    if (!/^-?\d+$/.test(rawAiTotal)) {
      return { error: invalidStepsError };
    }

    aiTotal = Number(rawAiTotal);

    if (!Number.isSafeInteger(aiTotal)) {
      return { error: invalidStepsError };
    }
  }

  const supabase = await createClient();
  const rpcArgs =
    aiTotal === undefined
      ? {
          p_assignment_id: assignmentId.data,
          p_steps: parsedSteps.data,
        }
      : {
          p_assignment_id: assignmentId.data,
          p_steps: parsedSteps.data,
          p_ai_total: aiTotal,
        };
  const { error } = await supabase.rpc("save_assignment_steps", rpcArgs);

  if (error) {
    return {
      error: mapSaveStepsError({
        code: error.code,
        details: error.details,
      }),
    };
  }

  redirect("/assignments");
}
