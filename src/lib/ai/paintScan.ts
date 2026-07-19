import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { SCAN_ACCEPTED_TYPES, MAX_SCAN_IMAGE_BYTES, type ScanImageMediaType } from "@/lib/paints/scanLimits";
import type { ExtractedPaintLabel } from "@/lib/paints/matchScan";

/**
 * "Scan paints from a photo" — reads paint-pot/bottle labels off a photo via
 * Claude Haiku vision. Same injectable-client + env-model-override pattern
 * as the gallery image moderator (`src/lib/ai/imageModeration.ts`); reuses
 * `ANTHROPIC_API_KEY`. Model defaults to claude-haiku-4-5; override via
 * `PAINT_SCAN_AI_MODEL`.
 *
 * Fail-soft: no key, a timeout, an unreadable/oversized image, or a thrown
 * client call all resolve to `[]` — a bad scan just shows the painter an
 * empty result, never a crash. The photo is passed straight through as
 * base64 and never written to disk/DB by this module or its caller.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1536;
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = [
  "You are reading a photo of miniature-painting paint pots/bottles for The",
  "Mini Mainframe, a wargaming hobby app. Identify every paint label you can",
  "read clearly: the brand (e.g. Citadel, Vallejo, The Army Painter,",
  "Scale75, Pro Acryl, AK Interactive, Two Thin Coats) and the exact paint",
  "name printed on the label.",
  "",
  "Skip anything you can't read confidently — a blurry, occluded, or",
  "unreadable label is better omitted than guessed. Don't invent paints",
  "that aren't visible in the photo. If the photo shows no paint",
  "pots/bottles at all, report an empty list.",
  "",
  "Call report_paint_labels with every paint you can confidently identify.",
].join("\n");

const SCAN_TOOL = {
  name: "report_paint_labels",
  description: "Report every miniature-paint label read from the submitted photo.",
  input_schema: {
    type: "object" as const,
    properties: {
      paints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            brand: {
              type: "string",
              description:
                "The paint brand/manufacturer printed on the label, e.g. Citadel, Vallejo, The Army Painter.",
            },
            name: {
              type: "string",
              description: "The exact paint name printed on the label, e.g. Mephiston Red.",
            },
          },
          required: ["brand", "name"],
          additionalProperties: false,
        },
      },
    },
    required: ["paints"],
    additionalProperties: false,
  },
} as const;

type ContentBlock = { type: string; [k: string]: unknown };

/** Minimal structural shape of the vision client we depend on — lets tests
 *  inject a mock returning canned tool output (no SDK, no network, no key). */
export interface AnthropicVisionLike {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system: string;
      tools: ReadonlyArray<typeof SCAN_TOOL>;
      tool_choice: { type: "tool"; name: string };
      messages: Array<{
        role: "user";
        content: Array<
          | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
          | { type: "text"; text: string }
        >;
      }>;
    }) => Promise<{ content: ContentBlock[] }>;
  };
}

export interface ScanDeps {
  client?: AnthropicVisionLike;
  apiKey?: string;
  model?: string;
}

function extractPaintLabels(content: ContentBlock[]): ExtractedPaintLabel[] {
  for (const block of content) {
    if (block.type === "tool_use" && (block as { name?: string }).name === SCAN_TOOL.name) {
      const input = (block as { input?: unknown }).input;
      const paints =
        input && typeof input === "object" ? (input as { paints?: unknown }).paints : undefined;
      if (!Array.isArray(paints)) continue;
      return paints
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const brand = (p as { brand?: unknown }).brand;
          const name = (p as { name?: unknown }).name;
          const b = typeof brand === "string" ? brand.trim() : "";
          const n = typeof name === "string" ? name.trim() : "";
          if (!b || !n) return null;
          return { brand: b, name: n };
        })
        .filter((x): x is ExtractedPaintLabel => x !== null);
    }
  }
  return [];
}

/**
 * Read paint-pot/bottle labels from a base64 photo. Never throws — every
 * failure mode (missing key, bad media type, oversized image, timeout,
 * thrown client call, empty/garbage response) resolves to `[]`.
 */
export async function scanPaintLabels(
  imageBase64: string,
  mediaType: ScanImageMediaType,
  deps: ScanDeps = {},
): Promise<ExtractedPaintLabel[]> {
  const apiKey = deps.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!deps.client && !apiKey) return [];
  if (!(SCAN_ACCEPTED_TYPES as readonly string[]).includes(mediaType)) return [];

  const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_SCAN_IMAGE_BYTES) return [];

  const client: AnthropicVisionLike =
    deps.client ?? (new Anthropic({ apiKey }) as unknown as AnthropicVisionLike);
  const model = deps.model ?? process.env["PAINT_SCAN_AI_MODEL"] ?? DEFAULT_MODEL;

  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [SCAN_TOOL],
        tool_choice: { type: "tool", name: SCAN_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageBase64 },
              },
              {
                type: "text",
                text: "Read every paint label you can in this photo and call report_paint_labels.",
              },
            ],
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`paint scan timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
      ),
    ]);
    return extractPaintLabels(response.content);
  } catch {
    return [];
  }
}
