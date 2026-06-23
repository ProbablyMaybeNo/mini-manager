import { describe, expect, test, vi } from "vitest";
import { generateRecipe, type AnthropicLike } from "@/lib/ai/recipeAi";
import type { Paint } from "@/lib/paints/types";
import type { RawRecipeProposal } from "@/lib/ai/recipeSchema";

function paint(over: Partial<Paint> & { id: string; hex: string }): Paint {
  return {
    brand: "Citadel",
    name: "Test",
    type: "Paint",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "",
    ...over,
  };
}

const catalog: Paint[] = [
  paint({ id: "c1", brand: "Citadel", name: "Macragge Blue", hex: "#0E4A8A", type: "Paint" }),
  paint({ id: "c2", brand: "Citadel", name: "Leadbelcher", hex: "#888B8D", type: "Metallic" }),
  paint({ id: "c3", brand: "Citadel", name: "Nuln Oil", hex: "#1A1A1A", type: "Wash" }),
  paint({ id: "v1", brand: "Vallejo Model Color", name: "Magic Blue", hex: "#1050A0", type: "Paint" }),
];

/** A mock Anthropic client that returns a fixed tool_use proposal. */
function mockClient(proposal: RawRecipeProposal): {
  client: AnthropicLike;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async () => ({
    content: [
      { type: "text", text: "Here is the recipe." },
      { type: "tool_use", name: "propose_recipe", input: proposal },
    ],
  }));
  return { client: { messages: { create } } as unknown as AnthropicLike, create };
}

describe("generateRecipe — end to end with a mocked Anthropic client", () => {
  const owned = new Set<string>(["c1"]);

  test("returns a grounded proposal and never surfaces hallucinated picks", async () => {
    const { client, create } = mockClient({
      summary: "Ultramarine marine",
      techniqueNotes: "Two thin coats; recess shade with Nuln Oil.",
      slots: [
        { role: "base", paintId: "c1", note: "basecoat" },
        { role: "metal", paintId: "c2", note: "drybrush metals" },
        { role: "wash", paintId: "c3", note: "recess" },
        { role: "highlight", paintId: "NON-EXISTENT-PAINT", note: "hallucinated" },
      ],
    });

    const res = await generateRecipe("Ultramarine marine, Citadel", catalog, owned, { client });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The hallucinated id is dropped; only catalog paints survive.
    expect(res.proposal.slots.map((s) => s.paintId)).toEqual(["c1", "c2", "c3"]);
    expect(res.proposal.droppedPaintIds).toContain("NON-EXISTENT-PAINT");
    expect(res.proposal.missingPaintIds.sort()).toEqual(["c2", "c3"]);
    expect(res.model).toBe("claude-haiku-4-5");

    // It used tool-use with a forced tool_choice and a Citadel-only candidate set.
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0];
    expect(args.tool_choice).toEqual({ type: "tool", name: "propose_recipe" });
    expect(args.messages[0]!.content).toContain("Macragge Blue");
    expect(args.messages[0]!.content).not.toContain("Magic Blue"); // Vallejo filtered out
  });

  test("fails cleanly when the model picks zero real paints", async () => {
    const { client } = mockClient({
      summary: "bad",
      techniqueNotes: "",
      slots: [{ role: "base", paintId: "FAKE", note: "" }],
    });
    const res = await generateRecipe("Citadel marine", catalog, owned, { client });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/ground/i);
  });

  test("rejects an empty command without calling the model", async () => {
    const { client, create } = mockClient({ summary: "", techniqueNotes: "", slots: [] });
    const res = await generateRecipe("   ", catalog, owned, { client });
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("errors when there is no API key and no injected client", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const res = await generateRecipe("Citadel marine", catalog, owned, {});
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  test("errors when the requested brand has no catalog paints", async () => {
    const { client, create } = mockClient({ summary: "", techniqueNotes: "", slots: [] });
    // A brand that exists in the alias map but not in this tiny catalog.
    const res = await generateRecipe("scale 75 dwarf", [], owned, { client });
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("handles a model response with no tool_use block", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: "I refuse." }],
    }));
    const client = { messages: { create } } as unknown as AnthropicLike;
    const res = await generateRecipe("Citadel marine", catalog, owned, { client });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/no usable recipe/i);
  });
});
