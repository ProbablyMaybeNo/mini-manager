"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { imports, projects } from "@/db/schema";
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
import { parseJsonList } from "@/lib/imports/jsonParser";
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

const applySchema = z.object({
  importId: z.string().min(1).max(32),
  editedTree: z.object({
    armyName: z.string().trim().min(1).max(120),
    totalPoints: z.number().int().nonnegative().max(99_999).nullable().optional(),
    faction: z.string().trim().max(120).nullable().optional(),
    units: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          count: z.number().int().min(1).max(999),
          points: z.number().int().nonnegative().max(99_999).nullable().optional(),
          notes: z.string().max(500).nullable().optional(),
        }),
      )
      .min(1, "Add at least one unit before applying"),
  }),
});

export type CreateTextImportInput = z.infer<typeof createTextSchema>;
export type CreateFileImportInput = z.infer<typeof createFileSchema>;
export type ApplyImportInput = z.infer<typeof applySchema>;

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
  let parserUsed: "pdf" | "battlescribe" | "json";
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
    } else if (ext === "json") {
      sourceFormat = "json";
      parserUsed = "json";
      const json = new TextDecoder("utf-8").decode(buffer);
      sourceTextPreview = json.slice(0, SOURCE_TEXT_PREVIEW_CHARS);
      result = parseJsonList(json);
    } else {
      return {
        ok: false,
        error: `Unsupported file type ".${ext}". Use .pdf, .ros, .rosz, or .json.`,
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

/**
 * Land an edited preview tree as a real project hierarchy. Creates one
 * Army container project, then one Unit child per `editedTree.units`
 * row. Counts are clamped to the schema's 1-9999 range. On any per-unit
 * insert error, partial inserts are rolled back manually — libsql
 * in-memory has no real transactions (same trade-off accepted in P5.3).
 *
 * Returns `{ ok: true, armyProjectId }` on success; the UI navigates
 * to `/projects/<armyProjectId>` to land on the new workspace.
 */
export async function applyImport(
  raw: ApplyImportInput,
): Promise<ActionResult<{ armyProjectId: string }>> {
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await currentUserId();
  const { importId, editedTree } = parsed.data;

  const importRows = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.ownerId, userId)))
    .limit(1);
  const importRow = importRows[0];
  if (!importRow) {
    return { ok: false, error: "Import not found." };
  }
  if (importRow.status === "applied") {
    return { ok: false, error: "This import has already been applied." };
  }

  const created: string[] = [];
  try {
    const armyInserted = await db
      .insert(projects)
      .values({
        ownerId: userId,
        type: "Army",
        name: editedTree.armyName.trim(),
        count: 0,
        faction: editedTree.faction?.trim() ?? null,
        pointsValue: editedTree.totalPoints ?? null,
      })
      .returning({ id: projects.id });
    const armyId = armyInserted[0]?.id;
    if (!armyId) {
      return { ok: false, error: "Failed to create the Army container." };
    }
    created.push(armyId);

    for (const unit of editedTree.units) {
      const trimmedName = unit.name.trim();
      const clampedCount = Math.min(Math.max(unit.count, 1), 9999);
      const unitInserted = await db
        .insert(projects)
        .values({
          ownerId: userId,
          parentId: armyId,
          type: "Unit",
          name: trimmedName,
          count: clampedCount,
          pointsValue: unit.points ?? null,
          notesMd: unit.notes?.trim() ?? null,
        })
        .returning({ id: projects.id });
      const unitId = unitInserted[0]?.id;
      if (!unitId) {
        throw new Error(`Failed to create unit "${trimmedName}".`);
      }
      created.push(unitId);
    }

    await db
      .update(imports)
      .set({
        status: "applied",
        appliedProjectId: armyId,
        updatedAt: new Date(),
      })
      .where(eq(imports.id, importId));

    revalidatePath("/projects");
    revalidatePath(`/projects/${armyId}`);
    return { ok: true, data: { armyProjectId: armyId } };
  } catch (err) {
    // Manual rollback: delete anything we created so far. Best-effort —
    // if a delete fails the painter sees an orphan project they can
    // clean up manually, but the apply path itself still surfaces the
    // root error.
    for (const id of created) {
      try {
        await db.delete(projects).where(eq(projects.id, id));
      } catch {
        // ignored
      }
    }
    await db
      .update(imports)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(imports.id, importId));
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to apply import.",
    };
  }
}

/* -----------------------------------------------------------------
   internals
   ----------------------------------------------------------------- */

interface PersistInput {
  sourceFormat: ImportSourceFormat;
  sourceTextPreview: string | null;
  sourceFileSize: number;
  parserUsed: "text" | "pdf" | "battlescribe" | "llm-fallback" | "json";
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
