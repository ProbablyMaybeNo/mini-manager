"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import type { Import, ImportSourceFormat } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";
import {
  parseBattleScribeRos,
  parseBattleScribeRosz,
} from "@/lib/imports/battleScribeParser";
import { extractPdfText } from "@/lib/imports/pdfExtractor";
import { parseWithLlm } from "@/lib/imports/llmFallbackParser";
import { parseTextList } from "@/lib/imports/textParser";
import type {
  ImportedTree,
  ImportedUnit,
  TextParseResult,
} from "@/lib/imports/types";

const SOURCE_TEXT_PREVIEW_CHARS = 500;
const MAX_PASTE_CHARS = 20_000;
const LLM_FALLBACK_THRESHOLD = 0.6;

const createTextSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(1, "Paste your army list first")
    .max(MAX_PASTE_CHARS, `Lists longer than ${MAX_PASTE_CHARS} characters aren't supported`),
});

const createFileSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  /** Base64-encoded file payload — the upload form encodes the file
   *  client-side so we keep the server-action API typed as JSON. */
  base64: z.string().min(1),
  /** Bytes (post-decode). Validated against the per-format ceilings. */
  size: z.number().int().nonnegative().max(20 * 1024 * 1024),
});

export type CreateTextImportInput = z.infer<typeof createTextSchema>;
export type CreateFileImportInput = z.infer<typeof createFileSchema>;

/**
 * Persist a pasted plain-text army list, run the text parser (or LLM
 * fallback if confidence is below threshold), and return the import
 * row id so the UI can redirect to the preview screen.
 */
export async function createTextImport(
  raw: CreateTextImportInput,
): Promise<ActionResult<{ importId: string }>> {
  const parsed = createTextSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const rawText = parsed.data.rawText;

  // First pass: heuristics.
  const heuristic = parseTextList(rawText);
  let result: TextParseResult = heuristic;
  let parserUsed: "text" | "llm-fallback" = "text";

  if (heuristic.confidence < LLM_FALLBACK_THRESHOLD) {
    const llm = await parseWithLlm(rawText);
    // Only adopt the LLM result if it actually produced units; otherwise
    // keep the heuristic output (which may be sparse but at least is
    // honest about confidence).
    if (llm.tree.units.length > 0) {
      result = llm;
      parserUsed = "llm-fallback";
    }
  }

  return await persistImport(userId, {
    sourceFormat: "plain-text",
    sourceTextPreview: rawText.slice(0, SOURCE_TEXT_PREVIEW_CHARS),
    sourceFileSize: rawText.length,
    parserUsed,
    result,
  });
}

/**
 * Persist an uploaded file (PDF / .ros / .rosz), dispatch to the right
 * parser based on extension, and return the import row id.
 */
export async function createFileImport(
  raw: CreateFileImportInput,
): Promise<ActionResult<{ importId: string }>> {
  const parsed = createFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file" };
  }
  const userId = await currentUserId();
  const { filename, base64, size } = parsed.data;

  let buffer: ArrayBuffer;
  try {
    const decoded = Buffer.from(base64, "base64");
    buffer = decoded.buffer.slice(
      decoded.byteOffset,
      decoded.byteOffset + decoded.byteLength,
    ) as ArrayBuffer;
  } catch {
    return { ok: false, error: "Could not decode the uploaded file." };
  }

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  let sourceFormat: ImportSourceFormat;
  let parserUsed: "pdf" | "battlescribe";
  let result: TextParseResult;
  let sourceTextPreview: string | null = null;

  try {
    if (ext === "pdf") {
      sourceFormat = "pdf";
      parserUsed = "pdf";
      const extracted = await extractPdfText(buffer);
      sourceTextPreview = extracted.text.slice(0, SOURCE_TEXT_PREVIEW_CHARS);
      const heuristic = parseTextList(extracted.text);
      result = heuristic;
      // PDF text often parses cleanly; only fall back if confidence
      // is really low.
      if (heuristic.confidence < LLM_FALLBACK_THRESHOLD) {
        const llm = await parseWithLlm(extracted.text);
        if (llm.tree.units.length > 0) {
          result = llm;
          parserUsed = "pdf";
        }
      }
      // Surface PDF-extractor warnings (e.g. multi-column flag) by
      // appending them to the result warnings.
      result = { ...result, warnings: [...extracted.warnings, ...result.warnings] };
    } else if (ext === "ros") {
      sourceFormat = "battlescribe-ros";
      parserUsed = "battlescribe";
      const xml = new TextDecoder("utf-8").decode(buffer);
      sourceTextPreview = xml.slice(0, SOURCE_TEXT_PREVIEW_CHARS);
      result = await parseBattleScribeRos(xml);
    } else if (ext === "rosz") {
      sourceFormat = "battlescribe-rosz";
      parserUsed = "battlescribe";
      result = await parseBattleScribeRosz(buffer);
    } else {
      return {
        ok: false,
        error: `Unsupported file type ".${ext}". Use .pdf, .ros, or .rosz.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read the file.",
    };
  }

  return await persistImport(userId, {
    sourceFormat,
    sourceTextPreview,
    sourceFileSize: size,
    parserUsed,
    result,
  });
}

/* -----------------------------------------------------------------
   internals
   ----------------------------------------------------------------- */

interface PersistInput {
  sourceFormat: ImportSourceFormat;
  sourceTextPreview: string | null;
  sourceFileSize: number;
  parserUsed: "text" | "pdf" | "battlescribe" | "llm-fallback";
  result: TextParseResult;
}

async function persistImport(
  userId: string,
  input: PersistInput,
): Promise<ActionResult<{ importId: string }>> {
  const cleanedUnits: ImportedUnit[] = input.result.tree.units.map((u) => ({
    ...u,
    name: u.name.trim(),
  }));
  const cleanedTree: ImportedTree = {
    ...input.result.tree,
    armyName: input.result.tree.armyName.trim(),
    units: cleanedUnits,
  };

  const status = cleanedUnits.length > 0 ? "parsed" : "failed";
  const errorMessage =
    cleanedUnits.length === 0
      ? "Parser produced no units. Edit the list and try again."
      : null;

  const inserted = await db
    .insert(imports)
    .values({
      ownerId: userId,
      sourceFormat: input.sourceFormat,
      sourceTextPreview: input.sourceTextPreview,
      sourceFileSize: input.sourceFileSize,
      status,
      parsedTree: JSON.stringify(cleanedTree),
      parserConfidence: input.result.confidence,
      parserUsed: input.parserUsed,
      errorMessage,
    })
    .returning({ id: imports.id });

  const importId = inserted[0]?.id;
  if (!importId) {
    return { ok: false, error: "Failed to persist import." };
  }

  revalidatePath("/projects/import");
  return { ok: true, data: { importId } };
}

/**
 * Public read helper used by the preview page. Lives in this module so
 * the action surface and read surface share the same Import shape.
 */
export async function fetchImportForPreview(
  importId: string,
): Promise<
  | {
      ok: true;
      import: Import;
      tree: ImportedTree;
      warnings: string[];
    }
  | { ok: false; error: string }
> {
  const userId = await currentUserId();
  const rows = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.ownerId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, error: "Import not found." };
  if (!row.parsedTree) {
    return {
      ok: false,
      error: row.errorMessage ?? "Import has not been parsed yet.",
    };
  }
  try {
    const tree = JSON.parse(row.parsedTree) as ImportedTree;
    return { ok: true, import: row, tree, warnings: [] };
  } catch {
    return { ok: false, error: "Parsed tree is corrupt." };
  }
}
