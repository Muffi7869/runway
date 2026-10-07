import { extractText, getDocumentProxy } from "unpdf";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("unpdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("unpdf")>();

  return {
    ...actual,
    extractText: vi.fn(actual.extractText),
    getDocumentProxy: vi.fn(actual.getDocumentProxy),
  };
});

import { MAX_SPEC_TEXT_CHARACTERS, SPEC_TEXT_TOO_LONG_MESSAGE } from "./helpers";
import {
  extractPdfText,
  looksLikePdf,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  PDF_TOO_BIG_MESSAGE,
  PDF_TOO_MANY_PAGES_MESSAGE,
} from "./pdf";

const encoder = new TextEncoder();
const mockedExtractText = vi.mocked(extractText);
const mockedGetDocumentProxy = vi.mocked(getDocumentProxy);
const NOT_A_PDF_MESSAGE = "That file isn't a PDF. Paste the text instead.";
const LOCKED_PDF_MESSAGE = "This PDF is locked. Paste the text instead.";
const UNREADABLE_PDF_MESSAGE =
  "Couldn't read text from this PDF. Paste the text instead.";

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildPdf({
  pages,
  text = "Test Assignment A: write 500 words.",
  includeText = true,
}: {
  pages: number;
  text?: string;
  includeText?: boolean;
}): Uint8Array {
  const fontObjectNumber = 3 + pages * 2;
  const objects: string[] = [];
  const pageReferences = Array.from(
    { length: pages },
    (_, index) => `${3 + index * 2} 0 R`,
  ).join(" ");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages} >>`,
  );

  for (let index = 0; index < pages; index += 1) {
    const contentObjectNumber = 4 + index * 2;
    const content = includeText
      ? `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
      : "";

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(
      `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

function fakeDocument(numPages = 1) {
  return {
    numPages,
    loadingTask: {
      destroy: vi.fn(async () => undefined),
    },
  } as unknown as Awaited<ReturnType<typeof getDocumentProxy>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("looksLikePdf", () => {
  it("finds the PDF signature within the first 1024 bytes", () => {
    expect(looksLikePdf(encoder.encode("prefix %PDF-1.7"))).toBe(true);
    expect(looksLikePdf(encoder.encode("plain text"))).toBe(false);
  });
});

describe("extractPdfText", () => {
  it("extracts made-up text from a valid one-page PDF", async () => {
    const result = await extractPdfText(buildPdf({ pages: 1 }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Test Assignment A: write 500 words.");
    }
  });

  it("accepts exactly 50 pages", async () => {
    const result = await extractPdfText(buildPdf({ pages: MAX_PDF_PAGES }));

    expect(result.ok).toBe(true);
  });

  it("rejects 51 pages before extracting text", async () => {
    const result = await extractPdfText(
      buildPdf({ pages: MAX_PDF_PAGES + 1 }),
    );

    expect(result).toEqual({
      ok: false,
      error: PDF_TOO_MANY_PAGES_MESSAGE,
    });
    expect(mockedExtractText).not.toHaveBeenCalled();
  });

  it("rejects a valid PDF with no text", async () => {
    await expect(
      extractPdfText(buildPdf({ pages: 1, includeText: false })),
    ).resolves.toEqual({ ok: false, error: UNREADABLE_PDF_MESSAGE });
  });

  it.each([
    ["plain text", encoder.encode("Test Assignment A")],
    ["ZIP content", encoder.encode("PK fake archive")],
  ])("rejects non-PDF %s bytes", async (_label, bytes) => {
    await expect(extractPdfText(bytes)).resolves.toEqual({
      ok: false,
      error: NOT_A_PDF_MESSAGE,
    });
    expect(mockedGetDocumentProxy).not.toHaveBeenCalled();
  });

  it("rejects a truncated PDF without exposing parser details", async () => {
    const pdf = buildPdf({ pages: 1 });

    await expect(
      extractPdfText(pdf.slice(0, Math.floor(pdf.length / 2))),
    ).resolves.toEqual({ ok: false, error: UNREADABLE_PDF_MESSAGE });
  });

  it("rejects an oversized PDF before parsing", async () => {
    const bytes = new Uint8Array(MAX_PDF_BYTES + 1);
    bytes.set(encoder.encode("%PDF-"));

    await expect(extractPdfText(bytes)).resolves.toEqual({
      ok: false,
      error: PDF_TOO_BIG_MESSAGE,
    });
    expect(mockedGetDocumentProxy).not.toHaveBeenCalled();
  });

  it("reports a password error thrown while opening", async () => {
    const error = new Error("private parser detail");
    error.name = "PasswordException";
    mockedGetDocumentProxy.mockRejectedValueOnce(error);

    await expect(extractPdfText(buildPdf({ pages: 1 }))).resolves.toEqual({
      ok: false,
      error: LOCKED_PDF_MESSAGE,
    });
  });

  it("reports a password error thrown while extracting and destroys the document", async () => {
    const document = fakeDocument();
    mockedGetDocumentProxy.mockResolvedValueOnce(document);
    mockedExtractText.mockRejectedValueOnce(new Error("Password required"));

    await expect(extractPdfText(buildPdf({ pages: 1 }))).resolves.toEqual({
      ok: false,
      error: LOCKED_PDF_MESSAGE,
    });
    expect(document.loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("removes NUL characters, normalizes line endings, and trims", async () => {
    const document = fakeDocument();
    mockedGetDocumentProxy.mockResolvedValueOnce(document);
    mockedExtractText.mockResolvedValueOnce({
      totalPages: 1,
      text: "  Test\u0000 Assignment A\r\nSecond line\r  ",
    });

    await expect(extractPdfText(buildPdf({ pages: 1 }))).resolves.toEqual({
      ok: true,
      text: "Test Assignment A\nSecond line",
    });
    expect(document.loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("rejects extracted text over the shared spec limit instead of cutting it", async () => {
    const document = fakeDocument();
    mockedGetDocumentProxy.mockResolvedValueOnce(document);
    mockedExtractText.mockResolvedValueOnce({
      totalPages: 1,
      text: "T".repeat(MAX_SPEC_TEXT_CHARACTERS + 1),
    });

    await expect(extractPdfText(buildPdf({ pages: 1 }))).resolves.toEqual({
      ok: false,
      error: SPEC_TEXT_TOO_LONG_MESSAGE,
    });
    expect(document.loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("returns only fixed messages without stack traces or undefined values", async () => {
    const pdf = buildPdf({ pages: 1 });
    const results = await Promise.all([
      extractPdfText(encoder.encode("plain text")),
      extractPdfText(pdf.slice(0, Math.floor(pdf.length / 2))),
      extractPdfText(new Uint8Array(MAX_PDF_BYTES + 1)),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).not.toContain("undefined");
        expect(result.error).not.toMatch(/\n\s+at\s/);
      }
    }
  });
});
