import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { GalleryModerationVerdict } from "@/db/schema";

/**
 * Automated image moderation for gallery submissions.
 *
 * A painter's model photo / branded card PNG is checked by Claude Haiku vision
 * BEFORE it enters the admin review queue. The point is defence-in-depth, not
 * to replace the human gate: only a clear `fail` (real-world explicit content)
 * blocks the submit; `pass`/`flag`/`error` all still land in `/admin/gallery`
 * for a person to approve — the verdict just directs the admin's attention.
 *
 * MINIATURES CAVEAT (the whole reason this is a bespoke prompt, not an
 * off-the-shelf NSFW classifier): painted miniatures routinely depict blood,
 * gore, skulls, demons, and stylised nudity on a *sculpt*. Those are models,
 * not real people, and must PASS. Only photographic real-world explicit
 * content fails. When unsure, the model is told to `flag`, not `fail`.
 *
 * Config: reuses `ANTHROPIC_API_KEY` (same key as the AI recipe creator).
 * Model defaults to claude-haiku-4-5; override via `MODERATION_AI_MODEL`.
 *
 * Fail-open: no key, a timeout, or a bad image all return `error` (the submit
 * proceeds to `pending` — a human still reviews it). The client is injectable
 * (`AnthropicVisionLike`) so the parse path is unit-testable with no network.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 300;
const TIMEOUT_MS = 20_000;
/** Anthropic rejects images over ~5MB; skip (fail-open) rather than error out. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export interface ModerationResult {
  verdict: GalleryModerationVerdict;
  /** One short sentence; the admin sees it on a flag, the user on a fail. */
  reason: string | null;
}

const SYSTEM_PROMPT = [
  "You are a content-safety reviewer for The Mini Mainframe, a miniature-painting",
  "hobby community gallery. Painters submit photos of miniatures, model figures,",
  "terrain, and painting work-in-progress. Decide if an image is appropriate for a",
  "public, all-ages hobby gallery.",
  "",
  "CRITICAL CONTEXT — painted miniatures are the norm and are ALWAYS acceptable,",
  "even when the SCULPT depicts blood, gore, skulls, demons, monsters, weapons,",
  "battle wounds, or partial/stylised nudity on a fantasy or sci-fi figure. These",
  "are painted models, not real people or real acts. NEVER fail a painted",
  "miniature, resin/plastic model, or diorama for its subject matter.",
  "",
  "FAIL only for real-world inappropriate content: photographic pornography or",
  "sexual acts involving real people, real graphic injury or medical gore of",
  "actual humans/animals, hate symbols presented approvingly, or any sexualisation",
  "of minors.",
  "",
  "FLAG (uncertain) when the image is not a hobby/miniature photo at all (a random",
  "selfie, meme, screenshot, product packaging) or you genuinely cannot tell if it",
  "crosses the line.",
  "",
  "PASS anything clearly showing a miniature, model, terrain, or hobby-desk scene.",
  "",
  "When you are unsure between pass and fail, choose FLAG — a human will review it.",
  "Call report_moderation with your verdict.",
].join("\n");

const MODERATE_TOOL = {
  name: "report_moderation",
  description:
    "Report whether a user-submitted image is appropriate for a public, all-ages miniature-painting hobby gallery.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: ["pass", "flag", "fail"],
        description:
          "pass = clearly appropriate hobby content; flag = borderline, not a hobby photo, or uncertain; fail = clear real-world explicit/inappropriate content.",
      },
      reason: {
        type: "string",
        description: "One short sentence explaining the verdict (required for flag and fail).",
      },
    },
    required: ["verdict", "reason"],
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
      tools: ReadonlyArray<typeof MODERATE_TOOL>;
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

export interface ModerateDeps {
  client?: AnthropicVisionLike;
  apiKey?: string;
  model?: string;
  /** Test/override hook: skip the network fetch and supply the image directly. */
  image?: { data: string; mediaType: SupportedMediaType };
}

function normalizeMediaType(contentType: string | null): SupportedMediaType | null {
  const base = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(base ?? "")
    ? (base as SupportedMediaType)
    : null;
}

async function fetchImage(
  url: string,
): Promise<{ data: string; mediaType: SupportedMediaType } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { error: err instanceof Error ? `image fetch failed: ${err.message}` : "image fetch failed" };
  }
  if (!res.ok) return { error: `image fetch returned ${res.status}` };
  const mediaType = normalizeMediaType(res.headers.get("content-type"));
  if (!mediaType) return { error: "unsupported image type" };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) return { error: "image too large to moderate" };
  return { data: buf.toString("base64"), mediaType };
}

function extractVerdict(content: ContentBlock[]): ModerationResult | null {
  for (const block of content) {
    if (block.type === "tool_use" && (block as { name?: string }).name === MODERATE_TOOL.name) {
      const input = (block as { input?: unknown }).input;
      if (input && typeof input === "object") {
        const { verdict, reason } = input as { verdict?: unknown; reason?: unknown };
        const v = verdict === "pass" || verdict === "fail" ? verdict : "flag";
        const r = typeof reason === "string" && reason.trim() ? reason.trim() : null;
        return { verdict: v, reason: r };
      }
    }
  }
  return null;
}

/**
 * Moderate a gallery-submission image by URL. Never throws — every failure
 * mode resolves to an `error` verdict so the caller can fail-open to the human
 * review queue.
 */
export async function moderateGalleryImage(
  imageUrl: string,
  deps: ModerateDeps = {},
): Promise<ModerationResult> {
  const apiKey = deps.apiKey ?? process.env["ANTHROPIC_API_KEY"];
  if (!deps.client && !apiKey) {
    return { verdict: "error", reason: "moderation not configured (ANTHROPIC_API_KEY missing)" };
  }

  let image = deps.image ?? null;
  if (!image) {
    const fetched = await fetchImage(imageUrl);
    if ("error" in fetched) return { verdict: "error", reason: fetched.error };
    image = fetched;
  }

  const client: AnthropicVisionLike =
    deps.client ?? (new Anthropic({ apiKey }) as unknown as AnthropicVisionLike);
  const model = deps.model ?? process.env["MODERATION_AI_MODEL"] ?? DEFAULT_MODEL;

  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [MODERATE_TOOL],
        tool_choice: { type: "tool", name: MODERATE_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: image.mediaType, data: image.data },
              },
              { type: "text", text: "Review this submitted gallery image and call report_moderation." },
            ],
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`moderation timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
      ),
    ]);

    const parsed = extractVerdict(response.content);
    // A tool-forced call that returns no verdict is anomalous — treat as flag
    // (route to a human) rather than silently passing.
    return parsed ?? { verdict: "flag", reason: "moderator returned no verdict" };
  } catch (err) {
    return {
      verdict: "error",
      reason: err instanceof Error ? err.message : "moderation call failed",
    };
  }
}
