import { describe, expect, test, vi } from "vitest";
import { scanPaintLabels, type AnthropicVisionLike } from "@/lib/ai/paintScan";

/**
 * Unit tests for the "Scan paints from a photo" vision reader. The
 * Anthropic vision client is injected, so the tool-call parse path is
 * exercised with no network, no key, and no real model call.
 *
 * Contract under test:
 *   - a tool_use `report_paint_labels` call parses into {brand, name}[]
 *   - blank/malformed entries are dropped rather than passed through
 *   - a tool response with no paints block → []
 *   - a thrown client call fails soft to [] (never throws)
 *   - no client and no API key → [] (not a throw)
 *   - an unsupported media type or an oversized payload → [] before any call
 */

const IMAGE_B64 = "AAAA";

function mockClient(paints: unknown): {
  client: AnthropicVisionLike;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async () => ({
    content: [
      { type: "text", text: "reading labels" },
      { type: "tool_use", name: "report_paint_labels", input: { paints } },
    ],
  }));
  return { client: { messages: { create } } as unknown as AnthropicVisionLike, create };
}

describe("scanPaintLabels — with a mocked vision client", () => {
  test("parses a clean list of {brand, name} pairs", async () => {
    const { client } = mockClient([
      { brand: "Citadel", name: "Mephiston Red" },
      { brand: "Vallejo", name: "Ivory" },
    ]);
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([
      { brand: "Citadel", name: "Mephiston Red" },
      { brand: "Vallejo", name: "Ivory" },
    ]);
  });

  test("trims whitespace off brand/name", async () => {
    const { client } = mockClient([{ brand: "  Citadel  ", name: "  Mephiston Red  " }]);
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([{ brand: "Citadel", name: "Mephiston Red" }]);
  });

  test("drops entries missing a brand or name", async () => {
    const { client } = mockClient([
      { brand: "Citadel", name: "Mephiston Red" },
      { brand: "", name: "Blank Brand" },
      { brand: "No Name", name: "" },
      { brand: "Citadel" }, // missing name entirely
      "not an object",
    ]);
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([{ brand: "Citadel", name: "Mephiston Red" }]);
  });

  test("an empty photo (no paints visible) returns []", async () => {
    const { client } = mockClient([]);
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([]);
  });

  test("a tool response with no paints array → []", async () => {
    const create = vi.fn(async () => ({ content: [{ type: "text", text: "hmm" }] }));
    const client = { messages: { create } } as unknown as AnthropicVisionLike;
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([]);
  });

  test("a thrown client call fails soft to []", async () => {
    const create = vi.fn(async () => {
      throw new Error("529 overloaded");
    });
    const client = { messages: { create } } as unknown as AnthropicVisionLike;
    const res = await scanPaintLabels(IMAGE_B64, "image/png", { client });
    expect(res).toEqual([]);
  });

  test("no client and no API key → [] (not a throw)", async () => {
    const prev = process.env["ANTHROPIC_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
    try {
      const res = await scanPaintLabels(IMAGE_B64, "image/png");
      expect(res).toEqual([]);
    } finally {
      if (prev !== undefined) process.env["ANTHROPIC_API_KEY"] = prev;
    }
  });

  test("an unsupported media type is refused before any client call", async () => {
    const { client, create } = mockClient([{ brand: "Citadel", name: "Mephiston Red" }]);
    // @ts-expect-error — deliberately an unsupported type for the guard test
    const res = await scanPaintLabels(IMAGE_B64, "image/gif", { client });
    expect(res).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  test("an oversized payload is refused before any client call", async () => {
    const { client, create } = mockClient([{ brand: "Citadel", name: "Mephiston Red" }]);
    const huge = "A".repeat(8 * 1024 * 1024); // ~6MB decoded, over the 5MB cap
    const res = await scanPaintLabels(huge, "image/png", { client });
    expect(res).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
