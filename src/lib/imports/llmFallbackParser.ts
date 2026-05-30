import "server-only";

import Groq from "groq-sdk";
import type { ImportedTree, ImportedUnit, TextParseResult } from "./types";

/**
 * Last-resort army-list parser. Called when the text heuristics return
 * confidence below 0.6 — i.e. the input is messy enough that regex
 * pattern-matching skipped most lines. llama-3.3-70b-versatile (fast,
 * free-tier Groq) converts the raw text into our ImportedTree shape.
 *
 * Cost containment:
 *   - 15-second hard timeout
 *   - 8000-char input cap (real lists are 1-3k chars)
 *   - response_format: json_object enforces JSON output
 *   - no caching layer in v1; defer per-content-hash cache to a future
 *     polish pass
 */

const MODEL_ID = "llama-3.3-70b-versatile";
const MAX_INPUT_CHARS = 8000;
const TIMEOUT_MS = 15_000;
const LLM_CONFIDENCE = 0.7;

const PROMPT_TEMPLATE = `You receive a raw wargaming army list in any format. Extract structured data.

Return ONLY a JSON object with this exact shape:
{
  "armyName": string,
  "totalPoints": number | null,
  "faction": string | null,
  "units": [{ "name": string, "count": number, "points": number | null, "notes": string | null }]
}

Rules:
- Combine multi-line unit descriptions into one entry.
- "10x Intercessors" -> name "Intercessors", count 10.
- Sergeants / characters with their own profile are separate units with count 1.
- Skip configuration / equipment lines that aren't units.
- If you can't parse a section, omit it rather than guessing.

List follows:
---
{{RAW_LIST}}
---

Reply with ONLY the JSON object, no prose.`;

interface RawLlmUnit {
  name?: unknown;
  count?: unknown;
  points?: unknown;
  notes?: unknown;
}
interface RawLlmTree {
  armyName?: unknown;
  totalPoints?: unknown;
  faction?: unknown;
  units?: unknown;
}

/**
 * Inject a Groq-compatible client (lets tests pass a mocked instance without
 * touching the network). Production callers pass nothing.
 */
export interface LlmFallbackDeps {
  client?: GroqLike;
  apiKey?: string;
}

export interface GroqLike {
  chat: {
    completions: {
      create: (params: {
        model: string;
        max_tokens: number;
        temperature: number;
        response_format: { type: "json_object" };
        messages: Array<{ role: "user"; content: string }>;
      }) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

export async function parseWithLlm(
  rawText: string,
  deps: LlmFallbackDeps = {},
): Promise<TextParseResult> {
  if (!rawText || rawText.trim().length === 0) {
    return failureResult(["Empty input"]);
  }
  if (rawText.length > MAX_INPUT_CHARS) {
    return failureResult([
      `Input too long for LLM fallback (${rawText.length} > ${MAX_INPUT_CHARS} chars). Trim the list and try again.`,
    ]);
  }

  const apiKey = deps.apiKey ?? process.env["GROQ_API_KEY"];
  if (!deps.client && !apiKey) {
    return failureResult([
      "Messy list detected and GROQ_API_KEY is not configured. Clean up the list manually or paste a clearer format.",
    ]);
  }

  const client: GroqLike =
    deps.client ?? (new Groq({ apiKey }) as unknown as GroqLike);

  const prompt = PROMPT_TEMPLATE.replace("{{RAW_LIST}}", rawText);

  let rawContent: string | null | undefined;
  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: MODEL_ID,
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`LLM call timed out after ${TIMEOUT_MS}ms`)),
          TIMEOUT_MS,
        ),
      ),
    ]);
    rawContent = response.choices[0]?.message?.content;
  } catch (err) {
    return failureResult([
      `LLM call failed: ${err instanceof Error ? err.message : "unknown error"}`,
    ]);
  }

  const replyText = rawContent ?? "";
  if (!replyText) {
    return failureResult(["LLM returned no text content"]);
  }

  const json = extractJsonObject(replyText);
  if (!json) {
    return failureResult([
      "LLM response was not valid JSON — try cleaning the list manually.",
    ]);
  }

  const tree = normaliseTree(json);
  if (tree.units.length === 0) {
    return {
      tree,
      confidence: 0,
      warnings: ["LLM extracted no units — list may be unsupported"],
    };
  }

  return { tree, confidence: LLM_CONFIDENCE, warnings: [] };
}

/* -----------------------------------------------------------------
   internals
   ----------------------------------------------------------------- */

function failureResult(warnings: string[]): TextParseResult {
  return {
    tree: { armyName: "Untitled army", units: [] },
    confidence: 0,
    warnings,
  };
}

function extractJsonObject(text: string): RawLlmTree | null {
  // Llama models occasionally wrap JSON in markdown fences despite the
  // "no prose" instruction. Strip the fences if present.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped) as unknown;
    if (parsed && typeof parsed === "object") return parsed as RawLlmTree;
  } catch {
    // Try to locate the first `{` ... last `}` if there's extra prose.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
        if (parsed && typeof parsed === "object") return parsed as RawLlmTree;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normaliseTree(raw: RawLlmTree): ImportedTree {
  const armyName = pickString(raw.armyName) ?? "Untitled army";
  const totalPoints = pickPositiveInteger(raw.totalPoints);
  const faction = pickString(raw.faction);

  const rawUnits = Array.isArray(raw.units) ? raw.units : [];
  const units: ImportedUnit[] = [];
  for (const u of rawUnits as RawLlmUnit[]) {
    const name = pickString(u.name);
    const count = pickPositiveInteger(u.count);
    if (!name || !count || count <= 0) continue;
    const points = pickPositiveInteger(u.points);
    const notes = pickString(u.notes);
    units.push({
      name,
      count,
      ...(points !== undefined ? { points } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });
  }

  return {
    armyName,
    units,
    ...(totalPoints !== undefined ? { totalPoints } : {}),
    ...(faction !== undefined ? { faction } : {}),
  };
}

function pickString(v: unknown): string | undefined {
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.length === 0) return undefined;
    return trimmed;
  }
  return undefined;
}

function pickPositiveInteger(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.trunc(v);
  }
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}
