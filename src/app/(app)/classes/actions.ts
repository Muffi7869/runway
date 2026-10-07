"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import { validateClassInput } from "@/lib/classes/validation";
import { createClient } from "@/lib/db/server";

export type ClassActionState = {
  error?: string;
  successMessage?: string;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function addClass(
  _previousState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const user = await requireOwner();
  const result = validateClassInput(
    textValue(formData, "name"),
    textValue(formData, "color"),
  );

  if (!result.success) {
    return { error: result.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({
    user_id: user.id,
    name: result.data.name,
    color: result.data.color,
  });

  if (error) {
    return { error: "Class could not be added. Please try again." };
  }

  revalidatePath("/classes");
  return { successMessage: "Class added." };
}

export async function updateClass(
  _previousState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const user = await requireOwner();
  const classId = textValue(formData, "class_id");
  const result = validateClassInput(
    textValue(formData, "name"),
    textValue(formData, "color"),
  );

  if (!result.success) {
    return { error: result.error };
  }

  if (!classId) {
    return { error: "Class could not be updated. Please try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ name: result.data.name, color: result.data.color })
    .eq("id", classId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Class could not be updated. Please try again." };
  }

  revalidatePath("/classes");
  return { successMessage: "Class updated." };
}
