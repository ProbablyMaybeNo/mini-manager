import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { Paint } from "@/lib/paints/types";
import {
  buildCandidates,
  groundProposal,
  MAX_SLOTS,
  type CandidatePaint,
} from "./recipeGrounding";
import { recipeRoles, type GroundedRecipeProposal, type RawRecipeProposal } from "./recipeSchema";

/**
 * The AI Recipe Creator's network layer.
 *
 * Flow: command → candidate list of REAL catalog paints (filtered by the
 * brand parsed from the command) → Claude tool-use call that must PICK
 * paintIds from that list → `groundProposal` validates every pick against the
 * catalog. The model literally cannot return a paint name; it returns ids,
 * and unknown ids are dropped. That is how hallucinated paints are prevented.
 *
 * Model: claude-haiku-4-5 by default (cheap; the task is a constrained pick,
 * not open-ended reasoning). Override via RECIPE_AI_MODEL.
 *
 * Testability: the Anthropic client is injected (`AnthropicLike`) exactly
 * like the Groq import-parser, so the grounding/validation path is unit-
 * testable with a mock that returns canned tool output — no network, no key.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 30_000;

/** The strict tool the model must call. paintId values are validated against
 *  the candidate catalog AFTER the call — the schema only shapes the JSON. */
const PROPOSE_TOOL = {
  name: "propose_recipe",
  description:
    "Return a miniature paint recipe by selecting paints from the provided candidate list. " +
    "Every paintId MUST be an `id` copied verbatim from a candidate paint — never invent one.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "One or two sentences describing the overall scheme.",
      },
      slots: {
        type: "array",
        description: `Ordered paint layers, max ${MAX_SLOTS}. One paint per slot.`,
        items: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: [...recipeRoles],
              description: "The role this paint plays (base, shadow, highlight, metal, …).",
            },
            paintId: {
              type: "string",
              description: "An `id` copied EXACTLY from a candidate paint. Do not invent ids.",
            },
            note: {
              type: "string",
              description: "Short how-to for this layer (thinning, drybrush, glaze, …).",
            },
          },
          required: ["role", "paintId", "note"],
          additionalProperties: false,
        },
      },
      techniqueNotes: {
        type: "string",
        description: "Overall technique guidance: order of operations, varnish, basing, tips.",
      },
    },
    required: ["summary", "slots", "techniqueNotes"],
    additionalProperties: false,
  },
} as const;

/** A content block as we read it back — a tool_use carries our proposal. */
type ResponseBlock =
  | { type: "tool_use"; name: string; input: unknown }
  | { type: string; [k: string]: unknown };

/** Minimal structural shape of the Anthropic messages client we depend on —
 *  lets tests pass a mock without the real SDK or a network call. */
export interface AnthropicLike {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      tools: ReadonlyArray<typeof PROPOSE_TOOL>;
      tool_choice: { type: "tool"; name: string };
      messages: Array<{ role: "user"; content: string }>;
    }) => Promise<{ content: ResponseBlock[] }>;
  };
}

export interface GenerateRecipeDeps {
  client?: AnthropicLike;
  apiKey?: string;
  model?: string;
}

export type GenerateRecipeResult =
  | { ok: true; proposal: GroundedRecipeProposal; model: string }
  | { ok: false; error: string };

function buildPrompt(command: string, candidates: CandidatePaint[], brands: string[]): string {
  const brandLine = brands.length
    ? `The painter asked for these brand(s): ${brands.join(", ")}. Only use candidates from those brands.`
    : `No specific brand was requested — pick the best-matching candidates across brands.`;
  const list = candidates
    .map(
      (c) =>
        `- id:${c.id} | ${c.brand}${c.line ? ` ${c.line}` : ""} | ${c.name} | ${c.type} | ${c.hex}`,
    )
    .join("\n");
  return [
    `You are a master miniature painter building a paint recipe.`,
    ``,
    `Command: "${command}"`,
    ``,
    brandLine,
    ``,
    `CANDIDATE PAINTS (the ONLY paints you may use — pick by id):`,
    list,
    ``,
    `Call propose_recipe. For every slot, copy a paintId EXACTLY from a candidate above.`,
    `Cover the relevant roles for the subject (base, shadow, highlight, metals, etc.).`,
    `Do NOT invent paint names or ids. If a needed colour isn't in the list, pick the closest candidate.`,
  ].join("\n");
}

function extractToolInput(content: ResponseBlock[]): RawRecipeProposal | null {
  for (const block of content) {
    if (block.type === "tool_use" && (block as { name?: string }).name === PROPOSE_TOOL.name) {
      const input = (block as { input?: unknown }).input;
      if (input && typeof input === "object") return input as RawRecipeProposal;
    }
  }
  return null;
}

/**
 * Generate a catalog-grounded recipe proposal from a natural-language command.
 *
 * @param command       the painter's free-text ask
 * @param paints        the full catalog (loaded server-side)
 * @param ownedPaintIds the user's owned paint ids (for the buy/own cross-check)
 * @param deps          optional injected client / key / model (tests + config)
 */
export async function generateRecipe(
  command: string,
  paints: ReadonlyArray<Paint>,
  ownedPaintIds: ReadonlySet<string>,
  deps: GenerateRecipeDeps = {},
): Promise<GenerateRecipeResult> {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, error: "Describe what you want to paint." };
  if (trimmed.length > 600) {
    return { ok: false, error: "Command is too long — keep it under 600 characters." };
  }

  const { candidates, brands } = buildCandidates(trimmed, paints);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: brands.length
        ? `No paints found for ${brands.join(", ")} in the catalog.`
        : "No paints available to build a recipe.",
    };
  }

  const apiKey = deps.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!deps.client && !apiKey) {
    return {
      ok: false,
      error: "AI recipes are not configured (ANTHROPIC_API_KEY missing).",
    };
  }

  const client: AnthropicLike =
    deps.client ?? (new Anthropic({ apiKey }) as unknown as AnthropicLike);
  const model = deps.model ?? process.env["RECIPE_AI_MODEL"] ?? DEFAULT_MODEL;
  const prompt = buildPrompt(trimmed, candidates, brands);

  let content: ResponseBlock[];
  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        tools: [PROPOSE_TOOL],
        tool_choice: { type: "tool", name: PROPOSE_TOOL.name },
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`AI call timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
      ),
    ]);
    content = response.content;
  } catch (err) {
    return {
      ok: false,
      error: `AI call failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  const raw = extractToolInput(content);
  if (!raw) return { ok: false, error: "AI returned no usable recipe." };

  // THE GATE: validate every paintId against the real catalog; drop the rest.
  const proposal = groundProposal(raw, paints, ownedPaintIds);
  if (proposal.slots.length === 0) {
    return {
      ok: false,
      error: "The AI couldn't ground its picks to real paints. Try rephrasing the command.",
    };
  }
  return { ok: true, proposal, model };
}
