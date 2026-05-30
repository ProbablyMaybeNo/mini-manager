import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ImportedTree, ImportedUnit, TextParseResult } from "./types";

/**
 * Last-resort army-list parser. Called when the text heuristics return
 * confidence below 0.6 — i.e. the input is messy enough that regex
 * pattern-matching skipped most lines. Claude Haiku 4.5 (fast + cheap,
 * well-suited for structured extraction) converts the raw text into our
 * ImportedTree shape.
 *
 * Cost containment:
 *   - 15-second hard timeout
 *   - 8000-char input cap (real lists are 1-3k chars)
 *   - response_format pinned via prompt; we re-parse + validate JSON
 *   - no caching layer in v1; defer per-content-hash cache to a future
 *     polish pass
 */

const MODEL_ID = "claude-haiku-4-5";
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
 * Inject an Anthropic client (lets tests pass a mocked instance without
 * touching the network). Production callers pass nothing.
 */
export interface LlmFallbackDeps {
  client?: AnthropicLike;
  apiKey?: string;
}

export interface AnthropicLike {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      messages: Array<{ role: "user"; content: string }>;
    }) => Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
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

  const apiKey = deps.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!deps.client && !apiKey) {
    return failureResult([
      "Messy list detected and ANTHROPIC_API_KEY is not configured. Clean up the list manually or paste a clearer format.",
    ]);
  }

  const client: AnthropicLike =
    deps.client ?? (new Anthropic({ apiKey }) as unknown as AnthropicLike);

  const prompt = PROMPT_TEMPLATE.replace("{{RAW_LIST}}", rawText);

  let response: Awaited<ReturnType<AnthropicLike["messages"]["create"]>>;
  try {
    response = await Promise.race([
      client.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`LLM call timed out after ${TIMEOUT_MS}ms`)),
          TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    return failureResult([
      `LLM call failed: ${err instanceof Error ? err.message : "unknown error"}`,
    ]);
  }

  const textBlock = response.content.find(
    (c) => c.type === "text" && typeof c.text === "string",
  );
  const replyText = textBlock?.text ?? "";
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
  // Claude sometimes wraps JSON in a fenced block despite the "no prose"
  // instruction. Strip the fences if present.
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
