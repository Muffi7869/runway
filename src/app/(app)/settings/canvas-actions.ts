"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/server";
import { prepareCanvasFeedUrlForStorage } from "@/lib/canvas/feed-url-value";
import { encryptToken } from "@/lib/crypto/tokens";
import { createClient } from "@/lib/db/server";

export type CanvasUrlActionState = {
  ok?: boolean;
  error?: string;
};

const SAVE_ERROR = "Couldn't save the link. Try again.";
const REMOVE_ERROR = "Couldn't remove the link. Try again.";

export async function saveCanvasUrlAction(
  _previousState: CanvasUrlActionState,
  formData: FormData,
): Promise<CanvasUrlActionState> {
  const user = await requireOwner();
  const submittedValue = formData.get("canvasUrl");
  const prepared = prepareCanvasFeedUrlForStorage(
    typeof submittedValue === "string" ? submittedValue : "",
    encryptToken,
  );

  if (!prepared.ok) {
    return { error: prepared.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ canvas_feed_url_encrypted: prepared.encryptedValue })
    .eq("user_id", user.id)
    .select("id");

  if (error || data.length === 0) {
    return { error: SAVE_ERROR };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCanvasUrlAction(
  _previousState: CanvasUrlActionState,
  _formData: FormData,
): Promise<CanvasUrlActionState> {
  const user = await requireOwner();
  void _previousState;
  void _formData;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .update({ canvas_feed_url_encrypted: null })
    .eq("user_id", user.id)
    .select("id");

  if (error || data.length === 0) {
    return { error: REMOVE_ERROR };
  }

  revalidatePath("/settings");
  return { ok: true };
}
