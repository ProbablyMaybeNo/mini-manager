import "server-only";

import { PDFParse } from "pdf-parse";

export interface PdfExtractResult {
  text: string;
  pageCount: number;
  warnings: string[];
}

/** 5 MiB upper bound — anything larger is suspicious for a list PDF. */
const MAX_PDF_BYTES = 5 * 1024 * 1024;
/** 50 pages is plenty for the longest realistic Crusade campaign packet. */
const MAX_PAGES = 50;
/** Below this character count after extraction we assume the PDF is
 *  image-only (scanned) and surface a clear error instead of guessing. */
const MIN_TEXT_CHARS = 8;

/**
 * Server-only PDF → plain-text extraction. Multi-column NewRecruit-style
 * exports sometimes interleave columns; we surface a warning rather than
 * fail so the painter can still edit the result in the preview.
 *
 * Throws `Error` with a painter-facing message for:
 *   - empty / 0-byte input
 *   - oversized input (> 5 MiB)
 *   - scanned PDFs with no embedded text
 *   - corrupt / unreadable PDFs
 */
export async function extractPdfText(
  buffer: ArrayBuffer,
): Promise<PdfExtractResult> {
  if (buffer.byteLength === 0) {
    throw new Error("PDF is empty.");
  }
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF is too large (${formatBytes(buffer.byteLength)}). Maximum is 5 MB.`,
    );
  }

  const warnings: string[] = [];
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const pageCount = result.total ?? result.pages?.length ?? 0;

    if (pageCount === 0) {
      throw new Error("PDF has no readable pages.");
    }
    if (pageCount > MAX_PAGES) {
      throw new Error(
        `PDF has ${pageCount} pages; maximum is ${MAX_PAGES}. Paste the list as text instead.`,
      );
    }

    const text = (result.text ?? "").trim();
    if (text.length < MIN_TEXT_CHARS) {
      throw new Error(
        "This PDF has no embedded text. Paste the list as text instead, or use a re-typed copy.",
      );
    }

    // Multi-column heuristic — if the text contains very long runs of
    // alternating short / non-newline-terminated fragments, flag it.
    if (looksLikeMultiColumn(text)) {
      warnings.push(
        "PDF appears to use a multi-column layout; some lines may be interleaved. Verify the preview.",
      );
    }

    return { text, pageCount, warnings };
  } catch (err) {
    if (err instanceof Error && /no embedded text|too large|empty|too many pages|no readable/i.test(err.message)) {
      throw err;
    }
    throw new Error(
      `Could not read this PDF. ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // best-effort cleanup; safe to ignore.
      }
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeMultiColumn(text: string): boolean {
  // Very conservative: lines under 25 chars that exceed 40% of total
  // suggest column-split fragments. Real list lines are typically
  // 30-80 chars.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 20) return false;
  const short = lines.filter((l) => l.trim().length < 25).length;
  return short / lines.length > 0.4;
}
