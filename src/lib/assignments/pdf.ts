import { extractText, getDocumentProxy } from "unpdf";

import {
  MAX_SPEC_TEXT_CHARACTERS,
  SPEC_TEXT_TOO_LONG_MESSAGE,
} from "./helpers";
import { MAX_PDF_BYTES, PDF_TOO_BIG_MESSAGE } from "./pdf-constants";

export { MAX_PDF_BYTES, PDF_TOO_BIG_MESSAGE } from "./pdf-constants";
export const MAX_PDF_PAGES = 50;
export const PDF_TOO_MANY_PAGES_MESSAGE =
  "This PDF is over 50 pages. Paste just the relevant part instead.";

const NOT_A_PDF_MESSAGE = "That file isn't a PDF. Paste the text instead.";
const LOCKED_PDF_MESSAGE = "This PDF is locked. Paste the text instead.";
const UNREADABLE_PDF_MESSAGE =
  "Couldn't read text from this PDF. Paste the text instead.";
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export type PdfTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function looksLikePdf(bytes: Uint8Array): boolean {
  const searchLength = Math.min(bytes.length, 1024);

  for (let index = 0; index <= searchLength - PDF_SIGNATURE.length; index += 1) {
    if (
      PDF_SIGNATURE.every(
        (expectedByte, signatureIndex) =>
          bytes[index + signatureIndex] === expectedByte,
      )
    ) {
      return true;
    }
  }

  return false;
}

function isPasswordError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";

  return name === "PasswordException" || /password/i.test(message);
}

function cleanExtractedText(text: string): string {
  return text.replaceAll("\u0000", "").replace(/\r\n?/g, "\n").trim();
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  if (bytes.length > MAX_PDF_BYTES) {
    return { ok: false, error: PDF_TOO_BIG_MESSAGE };
  }

  if (!looksLikePdf(bytes)) {
    return { ok: false, error: NOT_A_PDF_MESSAGE };
  }

  let document: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;

  try {
    document = await getDocumentProxy(Uint8Array.from(bytes));

    if (document.numPages > MAX_PDF_PAGES) {
      return { ok: false, error: PDF_TOO_MANY_PAGES_MESSAGE };
    }

    const extracted = await extractText(document, { mergePages: true });
    const cleanedText = cleanExtractedText(extracted.text);

    if (cleanedText === "") {
      return { ok: false, error: UNREADABLE_PDF_MESSAGE };
    }

    if (cleanedText.length > MAX_SPEC_TEXT_CHARACTERS) {
      return { ok: false, error: SPEC_TEXT_TOO_LONG_MESSAGE };
    }

    return { ok: true, text: cleanedText };
  } catch (error) {
    return {
      ok: false,
      error: isPasswordError(error)
        ? LOCKED_PDF_MESSAGE
        : UNREADABLE_PDF_MESSAGE,
    };
  } finally {
    if (document) {
      try {
        await document.loadingTask.destroy();
      } catch {
        // Destruction errors must not expose parser details or replace the result.
      }
    }
  }
}
