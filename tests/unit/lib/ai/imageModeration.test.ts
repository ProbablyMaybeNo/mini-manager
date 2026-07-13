import { describe, expect, test, vi } from "vitest";
import {
  moderateGalleryImage,
  type AnthropicVisionLike,
} from "@/lib/ai/imageModeration";

/**
 * Unit tests for the gallery image moderator. The Anthropic vision client is
 * injected and the image bytes are supplied directly, so the fetch + verdict
 * parse path is exercised with no network, no key, and no real model call.
 *
 * Contract under test:
 *   - verdicts pass/flag/fail are read straight from the tool_use block
 *   - an unknown/garbage verdict degrades to `flag` (route to a human), never pass
 *   - a tool call with no verdict block → `flag`
 *   - a thrown client / missing key → `error` (caller fails open to review)
 */

const IMAGE = { data: "AAAA", mediaType: "image/png" as const };

function mockClient(input: unknown): {
  client: AnthropicVisionLike;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async () => ({
    content: [
      { type: "text", text: "reviewing" },
      { type: "tool_use", name: "report_moderation", input },
    ],
  }));
  return { client: { messages: { create } } as unknown as AnthropicVisionLike, create };
}

describe("moderateGalleryImage — with a mocked vision client", () => {
  test("reads a clean pass verdict", async () => {
    const { client } = mockClient({ verdict: "pass", reason: "painted Space Marine" });
    const res = await moderateGalleryImage("https://blob/x.png", { client, image: IMAGE });
    expect(res.verdict).toBe("pass");
    expect(res.reason).toBe("painted Space Marine");
  });

  test("reads a fail verdict with its reason", async () => {
    const { client } = mockClient({ verdict: "fail", reason: "photographic explicit content" });
    const res = await moderateGalleryImage("https://blob/x.png", { client, image: IMAGE });
    expect(res.verdict).toBe("fail");
    expect(res.reason).toBe("photographic explicit content");
  });

  test("an unknown verdict degrades to flag, not pass", async () => {
    const { client } = mockClient({ verdict: "definitely-fine", reason: "" });
    const res = await moderateGalleryImage("https://blob/x.png", { client, image: IMAGE });
    expect(res.verdict).toBe("flag");
    // blank reason normalises to null
    expect(res.reason).toBeNull();
  });

  test("a tool response with no verdict block → flag", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "text", text: "hmm" }] }));
    const client = { messages: { create } } as unknown as AnthropicVisionLike;
    const res = await moderateGalleryImage("https://blob/x.png", { client, image: IMAGE });
    expect(res.verdict).toBe("flag");
  });

  test("a thrown client call fails open to error", async () => {
    const create = vi.fn(async () => {
      throw new Error("529 overloaded");
    });
    const client = { messages: { create } } as unknown as AnthropicVisionLike;
    const res = await moderateGalleryImage("https://blob/x.png", { client, image: IMAGE });
    expect(res.verdict).toBe("error");
    expect(res.reason).toContain("529");
  });

  test("no client and no API key → error (not a throw)", async () => {
    const prev = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      const res = await moderateGalleryImage("https://blob/x.png", { image: IMAGE });
      expect(res.verdict).toBe("error");
      expect(res.reason).toContain("not configured");
    } finally {
      if (prev !== undefined) process.env["ANTHROPIC_API_KEY"] = prev;
    }
  });
});
