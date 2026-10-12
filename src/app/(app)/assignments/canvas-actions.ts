"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  deadlineToFormValues,
  parseDeadline,
  validateAssignmentInput,
} from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { loadCanvasPlan } from "@/lib/canvas/load";
import { toCanvasPreview, type CanvasPreview } from "@/lib/canvas/preview";
import { isInImportWindow, resolveDueIso } from "@/lib/canvas/window";
import { createClient } from "@/lib/db/server";

const importRowSchema = z.object({
  uid: z.string().min(1),
  classId: z.string().uuid(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
});

const importRowsSchema = z.array(z.unknown()).max(100);
const uidSchema = z.string().min(1);

export type CanvasPreviewActionResult =
  | { ok: true; preview: CanvasPreview }
  | { ok: false; error: string };

export type CanvasImportSummary = {
  imported: number;
  alreadyThere: number;
  failed: { index: number; message: string }[];
};

export type CanvasImportActionState = {
  summary?: CanvasImportSummary;
  error?: string;
};

export type CanvasUpdateActionState = {
  ok?: boolean;
  error?: string;
};

export async function previewCanvasAction(): Promise<CanvasPreviewActionResult> {
  const user = await requireOwner();
  const supabase = await createClient();
  const now = new Date();
  const loaded = await loadCanvasPlan(supabase, user.id, now);

  if (!loaded.ok) {
    return loaded;
  }

  return {
    ok: true,
    preview: toCanvasPreview(
      loaded.value.plan,
      loaded.value.skipped,
      loaded.value.classes,
      now,
    ),
  };
}

function parseImportRows(formData: FormData) {
  const rawRows = formData.get("rows");

  if (typeof rawRows !== "string" || rawRows.length > 20_000) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawRows);
    const result = importRowsSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    return result.data.map((value, index) => ({
      index,
      result: importRowSchema.safeParse(value),
    }));
  } catch {
    return null;
  }
}

export async function importCanvasAction(
  _previousState: CanvasImportActionState,
  formData: FormData,
): Promise<CanvasImportActionState> {
  const user = await requireOwner();
  const rows = parseImportRows(formData);

  if (!rows) {
    return { error: "Choose valid assignments to import." };
  }

  const supabase = await createClient();
  const now = new Date();
  const loaded = await loadCanvasPlan(supabase, user.id, now);

  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const freshByUid = new Map(
    loaded.value.plan.fresh.map((item) => [item.uid, item]),
  );
  const summary: CanvasImportSummary = {
    imported: 0,
    alreadyThere: 0,
    failed: [],
  };

  for (const parsedRow of rows) {
    const { index } = parsedRow;

    if (!parsedRow.result.success) {
      summary.failed.push({
        index,
        message: "Choose valid import details.",
      });
      continue;
    }

    const submitted = parsedRow.result.data;
    const fresh = freshByUid.get(submitted.uid);

    if (!fresh) {
      continue;
    }

    const { data: ownedClass, error: classError } = await supabase
      .from("classes")
      .select("id")
      .eq("id", submitted.classId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (classError) {
      summary.failed.push({
        index,
        message: "Couldn't import this assignment. Try again.",
      });
      continue;
    }

    if (!ownedClass) {
      summary.failed.push({ index, message: "Choose a class." });
      continue;
    }

    const resolved = resolveDueIso(
      fresh.due,
      fresh.due.kind === "date" ? submitted.time : undefined,
    );

    if (!resolved.ok || !isInImportWindow(resolved.iso, now)) {
      summary.failed.push({
        index,
        message: "That due time is already past or outside the import window.",
      });
      continue;
    }

    const deadline = deadlineToFormValues(resolved.iso);
    const validated = validateAssignmentInput(
      {
        classId: submitted.classId,
        title: fresh.title,
        deadlineDate: deadline.date,
        deadlineTime: deadline.time,
        weight: "medium",
        specText: "",
      },
      { mode: "create", now },
    );

    if (!validated.ok) {
      summary.failed.push({
        index,
        message: "That assignment couldn't be imported. Refresh and try again.",
      });
      continue;
    }

    const { error: insertError } = await supabase.from("assignments").insert({
      user_id: user.id,
      class_id: validated.value.classId,
      title: validated.value.title,
      type: "assignment",
      deadline:
        fresh.due.kind === "datetime"
          ? resolved.iso
          : validated.value.deadlineIso,
      spec_text: null,
      weight: "medium",
      status: "active",
      canvas_uid: fresh.uid,
    });

    if (!insertError) {
      summary.imported += 1;
    } else if (insertError.code === "23505") {
      summary.alreadyThere += 1;
    } else {
      summary.failed.push({
        index,
        message: "Couldn't import this assignment. Try again.",
      });
    }
  }

  revalidatePath("/assignments");
  return { summary };
}

export async function updateCanvasDueDateAction(
  _previousState: CanvasUpdateActionState,
  formData: FormData,
): Promise<CanvasUpdateActionState> {
  const user = await requireOwner();
  const submittedUid = formData.get("uid");
  const uid = uidSchema.safeParse(submittedUid);

  if (!uid.success) {
    return { error: "That assignment changed. Refresh and try again." };
  }

  const supabase = await createClient();
  const now = new Date();
  const loaded = await loadCanvasPlan(supabase, user.id, now);

  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const changed = loaded.value.plan.changed.find(
    (item) => item.uid === uid.data,
  );

  if (!changed) {
    return { error: "That assignment changed. Refresh and try again." };
  }

  let newDeadline: string;

  if (changed.newDue.kind === "date") {
    const storedTime = deadlineToFormValues(changed.oldDeadline).time;
    const parsed = parseDeadline({
      date: changed.newDue.date,
      time: storedTime,
    });

    if (!parsed.ok) {
      return { error: "That assignment changed. Refresh and try again." };
    }

    newDeadline = parsed.value;
  } else {
    newDeadline = changed.newDue.iso;
  }

  if (new Date(newDeadline).getTime() <= now.getTime()) {
    return { error: "That new due time is already past." };
  }

  const { data, error } = await supabase
    .from("assignments")
    .update({ deadline: newDeadline })
    .eq("user_id", user.id)
    .eq("canvas_uid", uid.data)
    .eq("status", "active")
    .select("id");

  if (error || data.length === 0) {
    return { error: "That assignment changed. Refresh and try again." };
  }

  revalidatePath("/assignments");
  return { ok: true };
}
