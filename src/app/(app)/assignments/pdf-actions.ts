"use server";

import { requireOwner } from "@/lib/auth/server";
import {
  extractPdfText,
  MAX_PDF_BYTES,
  PDF_TOO_BIG_MESSAGE,
  type PdfTextResult,
} from "@/lib/assignments/pdf";

export async function extractSpecFromPdfAction(
  formData: FormData,
): Promise<PdfTextResult> {
  await requireOwner();

  const file = formData.get("pdf");

  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a PDF file." };
  }

  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: PDF_TOO_BIG_MESSAGE };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return extractPdfText(bytes);
}
