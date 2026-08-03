import { describe, expect, test } from "vitest";
import { groundProposal } from "@/lib/ai/recipeGrounding";
// NOT `@/lib/types` — there are two `Paint` types and `groundProposal` takes
// the catalog one, which additionally requires hexConfidence/hexSource/sourceUrl.
import type { Paint } from "@/lib/paints/types";

/**
 * The model is handed candidate lines beginning with our internal database id
 * and echoes them back into human-facing prose ("prime with Grey-green
 * (15157)"). A painter reads that as a product code. These cover the strip —
 * and, more importantly, that it does NOT eat legitimate numbers.
 */

const paint = (id: string, name: string): Paint =>
  ({
    id,
    name,
    brand: "AK Interactive",
    hex: "#556b2f",
    type: "acrylic",
    hexConfidence: "exact",
    hexSource: "test",
    sourceUrl: "",
  }) as unknown as Paint;

const CATALOG: ReadonlyArray<Paint> = [
  paint("15157", "WWI German Grey-green Primer"),
  paint("14833", "Olive Drab"),
];

function ground(summary: string, techniqueNotes: string, note = "") {
  return groundProposal(
    {
      summary,
      techniqueNotes,
      slots: [{ paintId: "15157", role: "base", note }],
    } as never,
    CATALOG,
    new Set<string>(),
  );
}

describe("catalog ids never reach human-facing prose", () => {
  test("strips a parenthesised id from techniqueNotes", () => {
    const r = ground("", "Prime with WWI German Grey-green (15157) for a muted base.");
    expect(r.techniqueNotes).toBe("Prime with WWI German Grey-green for a muted base.");
    expect(r.techniqueNotes).not.toMatch(/15157/);
  });

  test("strips from summary and from a slot note", () => {
    const r = ground("Uses Olive Drab (14833).", "", "Base coat (14833)");
    expect(r.summary).toBe("Uses Olive Drab.");
    expect(r.slots[0]?.note).toBe("Base coat");
  });

  test("strips an `id:` form too", () => {
    const r = ground("", "Layer id:14833 over the fatigues.");
    expect(r.techniqueNotes).toBe("Layer over the fatigues.");
  });

  test("LEAVES a number that is not a catalog id — e.g. a kit year", () => {
    const r = ground("", "Infernus Squad (2023) in three thin coats.");
    expect(r.techniqueNotes).toBe("Infernus Squad (2023) in three thin coats.");
  });

  test("LEAVES ratios, counts and measurements untouched", () => {
    const text = "Thin 2:1 with medium, apply (2) coats, 50/50 glaze at 0.4mm.";
    const r = ground("", text);
    expect(r.techniqueNotes).toBe(text);
  });

  test("does not leave doubled spaces or a space before punctuation", () => {
    const r = ground("", "Use Grey-green (15157), then Olive Drab (14833).");
    expect(r.techniqueNotes).toBe("Use Grey-green, then Olive Drab.");
    expect(r.techniqueNotes).not.toMatch(/ {2}| ,| \./);
  });
});
