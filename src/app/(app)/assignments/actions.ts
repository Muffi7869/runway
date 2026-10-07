"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  validateAssignmentInput,
  type AssignmentInputErrors,
} from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";

const assignmentIdSchema = z.string().uuid();

export type AssignmentFormValues = {
  assignmentId?: string;
  classId: string;
  title: string;
  deadlineDate: string;
  deadlineTime: string;
  weight: string;
  specText: string;
};

export type AssignmentActionState = {
  ok?: boolean;
  formError?: string;
  fieldErrors?: AssignmentInputErrors;
  values?: AssignmentFormValues;
};

export type AssignmentStatusActionState = {
  ok?: boolean;
  error?: string;
};

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function assignmentValues(formData: FormData): AssignmentFormValues {
  const assignmentId = textValue(formData, "assignmentId");

  return {
    ...(assignmentId ? { assignmentId } : {}),
    classId: textValue(formData, "classId"),
    title: textValue(formData, "title"),
    deadlineDate: textValue(formData, "deadlineDate"),
    deadlineTime: textValue(formData, "deadlineTime"),
    weight: textValue(formData, "weight"),
    specText: textValue(formData, "specText"),
  };
}

async function classBelongsToOwner(classId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("user_id", userId)
    .maybeSingle();

  return { belongs: Boolean(data), error };
}

export async function createAssignmentAction(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const user = await requireOwner();
  const values = assignmentValues(formData);
  const result = validateAssignmentInput(values, {
    mode: "create",
    now: new Date(),
  });

  if (!result.ok) {
    return { fieldErrors: result.errors, values };
  }

  const classCheck = await classBelongsToOwner(result.value.classId, user.id);

  if (classCheck.error) {
    return {
      formError: "Assignment could not be saved. Please try again.",
      values,
    };
  }

  if (!classCheck.belongs) {
    return {
      fieldErrors: { classId: "Choose a class." },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assignments").insert({
    user_id: user.id,
    class_id: result.value.classId,
    title: result.value.title,
    type: "assignment",
    deadline: result.value.deadlineIso,
    spec_text: result.value.specText,
    weight: result.value.weight,
    status: "active",
  });

  if (error) {
    return {
      formError: "Assignment could not be saved. Please try again.",
      values,
    };
  }

  redirect("/assignments");
}

export async function updateAssignmentAction(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const user = await requireOwner();
  const values = assignmentValues(formData);
  const assignmentId = assignmentIdSchema.safeParse(values.assignmentId);

  if (!assignmentId.success) {
    return {
      formError:
        "This assignment can't be edited. Restore it first, or it no longer exists.",
      values,
    };
  }

  const supabase = await createClient();
  const { data: storedAssignment, error: loadError } = await supabase
    .from("assignments")
    .select("id,deadline,status")
    .eq("id", assignmentId.data)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (loadError) {
    return {
      formError: "Assignment could not be loaded. Please try again.",
      values,
    };
  }

  if (!storedAssignment) {
    return {
      formError:
        "This assignment can't be edited. Restore it first, or it no longer exists.",
      values,
    };
  }

  const result = validateAssignmentInput(values, {
    mode: "edit",
    now: new Date(),
    currentDeadlineIso: storedAssignment.deadline,
  });

  if (!result.ok) {
    return { fieldErrors: result.errors, values };
  }

  const classCheck = await classBelongsToOwner(result.value.classId, user.id);

  if (classCheck.error) {
    return {
      formError: "Assignment could not be saved. Please try again.",
      values,
    };
  }

  if (!classCheck.belongs) {
    return {
      fieldErrors: { classId: "Choose a class." },
      values,
    };
  }

  const { data: updatedAssignments, error: updateError } = await supabase
    .from("assignments")
    .update({
      class_id: result.value.classId,
      title: result.value.title,
      deadline: result.value.deadlineIso,
      weight: result.value.weight,
      spec_text: result.value.specText,
    })
    .eq("id", assignmentId.data)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id");

  if (updateError) {
    return {
      formError: "Assignment could not be saved. Please try again.",
      values,
    };
  }

  if (!updatedAssignments.length) {
    return {
      formError:
        "This assignment can't be edited. Restore it first, or it no longer exists.",
      values,
    };
  }

  redirect("/assignments");
}

async function updateAssignmentStatus(
  assignmentId: string,
  userId: string,
  currentStatuses: string[],
  nextStatus: "active" | "done" | "dropped",
): Promise<AssignmentStatusActionState> {
  if (!assignmentIdSchema.safeParse(assignmentId).success) {
    return { error: "That assignment changed. Refresh and try again." };
  }

  const supabase = await createClient();
  let query = supabase
    .from("assignments")
    .update({ status: nextStatus })
    .eq("id", assignmentId)
    .eq("user_id", userId);

  query =
    currentStatuses.length === 1
      ? query.eq("status", currentStatuses[0])
      : query.in("status", currentStatuses);

  const { data, error } = await query.select("id");

  if (error || !data.length) {
    return { error: "That assignment changed. Refresh and try again." };
  }

  revalidatePath("/assignments");
  return { ok: true };
}

export async function markDoneAction(
  _previousState: AssignmentStatusActionState,
  formData: FormData,
): Promise<AssignmentStatusActionState> {
  const user = await requireOwner();
  return updateAssignmentStatus(
    textValue(formData, "assignmentId"),
    user.id,
    ["active"],
    "done",
  );
}

export async function dropAction(
  _previousState: AssignmentStatusActionState,
  formData: FormData,
): Promise<AssignmentStatusActionState> {
  const user = await requireOwner();
  return updateAssignmentStatus(
    textValue(formData, "assignmentId"),
    user.id,
    ["active"],
    "dropped",
  );
}

export async function restoreAction(
  _previousState: AssignmentStatusActionState,
  formData: FormData,
): Promise<AssignmentStatusActionState> {
  const user = await requireOwner();
  return updateAssignmentStatus(
    textValue(formData, "assignmentId"),
    user.id,
    ["done", "dropped"],
    "active",
  );
}
