import { describe, expect, test } from "vitest";
import {
  buildCandidates,
  groundProposal,
  parseBrands,
  MAX_SLOTS,
} from "@/lib/ai/recipeGrounding";
import { ROLE_TO_TECHNIQUE } from "@/lib/ai/recipeSchema";
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
  paint({ id: "v2", brand: "Vallejo Model Color", name: "Black", hex: "#222124", type: "Paint" }),
  paint({ id: "a1", brand: "AK Interactive", name: "Rust", hex: "#8B4513", type: "Paint" }),
];

describe("parseBrands", () => {
  test("extracts an explicitly named brand", () => {
    expect(parseBrands("Ultramarine, Citadel paints", catalog)).toContain("Citadel");
  });

  test("resolves the vallejo alias to a catalog brand", () => {
    expect(parseBrands("a goblin in vallejo", catalog)).toContain("Vallejo Model Color");
  });

  test("returns empty when no brand is named", () => {
    expect(parseBrands("a rusty robot", catalog)).toEqual([]);
  });
});

describe("buildCandidates", () => {
  test("filters candidates to the requested brand", () => {
    const { candidates, brands } = buildCandidates("Citadel space marine", catalog);
    expect(brands).toContain("Citadel");
    expect(candidates.every((c) => c.brand === "Citadel")).toBe(true);
    expect(candidates.map((c) => c.id).sort()).toEqual(["c1", "c2", "c3"]);
  });

  test("spreads candidates across paint types (metallic + wash present)", () => {
    const { candidates } = buildCandidates("Citadel anything", catalog);
    const types = new Set(candidates.map((c) => c.type));
    expect(types.has("Metallic")).toBe(true);
    expect(types.has("Wash")).toBe(true);
  });

  test("cross-brand when no brand requested", () => {
    const { candidates, brands } = buildCandidates("a rusty robot", catalog);
    expect(brands).toEqual([]);
    const brandsSeen = new Set(candidates.map((c) => c.brand));
    expect(brandsSeen.size).toBeGreaterThan(1);
  });

  test("respects the candidate limit", () => {
    const big: Paint[] = Array.from({ length: 50 }, (_, i) =>
      paint({ id: `p${i}`, hex: "#123456", brand: "Citadel" }),
    );
    const { candidates } = buildCandidates("Citadel", big, 10);
    expect(candidates).toHaveLength(10);
  });

  test("skips rows with no hex", () => {
    const withBlank = [...catalog, paint({ id: "blank", brand: "Citadel", hex: "" })];
    const { candidates } = buildCandidates("Citadel", withBlank);
    expect(candidates.find((c) => c.id === "blank")).toBeUndefined();
  });
});

describe("groundProposal — the anti-hallucination gate", () => {
  const owned = new Set<string>(["c1"]);

  test("keeps only catalog paintIds and DROPS hallucinated ones", () => {
    const raw: RawRecipeProposal = {
      summary: "Blue marine",
      techniqueNotes: "Two thin coats.",
      slots: [
        { role: "base", paintId: "c1", note: "basecoat" },
        { role: "metal", paintId: "FAKE-999", note: "invented" },
        { role: "wash", paintId: "c3", note: "recess shade" },
        { role: "highlight", paintId: "Citadel Calgar Blue", note: "a name, not an id" },
      ],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots.map((s) => s.paintId)).toEqual(["c1", "c3"]);
    expect(out.droppedPaintIds.sort()).toEqual(["Citadel Calgar Blue", "FAKE-999"]);
  });

  test("never fabricates a paint name — every kept slot resolves to a catalog row", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: [{ role: "base", paintId: "c2", note: "" }],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots[0]!.brand).toBe("Citadel");
    expect(out.slots[0]!.name).toBe("Leadbelcher");
    expect(out.slots[0]!.hex).toBe("#888B8D");
  });

  test("maps roles to the correct DB technique", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: [
        { role: "base", paintId: "c1", note: "" },
        { role: "metal", paintId: "c2", note: "" },
        { role: "shadow", paintId: "c3", note: "" },
      ],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots[0]!.layer).toBe(ROLE_TO_TECHNIQUE.base); // basecoat
    expect(out.slots[1]!.layer).toBe("metallic");
    expect(out.slots[2]!.layer).toBe("wash");
  });

  test("normalises near-miss role strings", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: [
        { role: "Base Coat", paintId: "c1", note: "" },
        { role: "metallic", paintId: "c2", note: "" },
        { role: "shadows", paintId: "c3", note: "" },
      ],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots.map((s) => s.role)).toEqual(["base", "metal", "shadow"]);
  });

  test("computes owned vs missing from inventory", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: [
        { role: "base", paintId: "c1", note: "" }, // owned
        { role: "metal", paintId: "c2", note: "" }, // not owned
        { role: "wash", paintId: "c3", note: "" }, // not owned
      ],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots.find((s) => s.paintId === "c1")!.owned).toBe(true);
    expect(out.slots.find((s) => s.paintId === "c2")!.owned).toBe(false);
    expect(out.missingPaintIds.sort()).toEqual(["c2", "c3"]);
  });

  test("de-dups the same paint in the same role", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: [
        { role: "base", paintId: "c1", note: "first" },
        { role: "base", paintId: "c1", note: "dup" },
      ],
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots).toHaveLength(1);
  });

  test("caps the slot count at MAX_SLOTS", () => {
    const raw: RawRecipeProposal = {
      summary: "",
      techniqueNotes: "",
      slots: Array.from({ length: MAX_SLOTS + 5 }, (_, i) => ({
        role: i % 2 ? "highlight" : "base",
        paintId: i % 2 ? "c2" : "c1",
        note: `${i}`,
      })),
    };
    const out = groundProposal(raw, catalog, owned);
    expect(out.slots.length).toBeLessThanOrEqual(MAX_SLOTS);
  });

  test("empty proposal yields zero slots (caller treats as failure)", () => {
    const out = groundProposal(
      { summary: "", techniqueNotes: "", slots: [] },
      catalog,
      owned,
    );
    expect(out.slots).toHaveLength(0);
  });
});
