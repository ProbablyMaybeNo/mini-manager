import { describe, expect, test } from "vitest";
import { recipeToMarkdown } from "@/lib/recipes/markdown";

const sample = {
  recipe: {
    name: "Salamanders Power Armor",
    bodyType: "infantry",
    notesMd: "Two thin coats on the basecoat.",
  },
  slots: [
    {
      technique: "basecoat" as const,
      paintName: "Caliban Green",
      paintBrand: "Citadel",
      hex: "#0F4A33",
      notesMd: null,
    },
    {
      technique: "wash" as const,
      paintName: "Strong Tone",
      paintBrand: "Army Painter",
      hex: "#3A2618",
      notesMd: "Recess shade only.",
    },
    {
      technique: "basecoat" as const,
      paintName: "Retributor Gold",
      paintBrand: "Citadel",
      hex: "#9C7B2A",
      notesMd: null,
    },
    {
      technique: "glaze" as const,
      paintName: null,
      paintBrand: null,
      hex: "#FF66CC",
      notesMd: null,
    },
  ],
  publicUrl: "https://miniaturemanager.app/r/abc123",
};

describe("recipeToMarkdown", () => {
  test("renders a known recipe to the expected Markdown shape", () => {
    expect(recipeToMarkdown(sample)).toMatchInlineSnapshot(`
      "# Salamanders Power Armor

      *A Mini Mainframe recipe*

      ## Slots

      1. **Basecoat** — Citadel Caliban Green \`#0F4A33\`
      2. **Wash** — Army Painter Strong Tone \`#3A2618\`
         *Recess shade only.*
      3. **Basecoat** — Citadel Retributor Gold \`#9C7B2A\`
      4. **Glaze** — Custom mix \`#FF66CC\`

      ## Notes

      Two thin coats on the basecoat.

      ---
      [Made with The Mini Mainframe](https://miniaturemanager.app/r/abc123)"
    `);
  });

  test("omits the footer link when publicUrl is missing", () => {
    const out = recipeToMarkdown({
      recipe: { name: "Unpublished", bodyType: "infantry", notesMd: null },
      slots: [
        {
          technique: "basecoat",
          paintName: "Mournfang Brown",
          paintBrand: "Citadel",
          hex: "#5d3618",
          notesMd: null,
        },
      ],
    });
    expect(out).not.toContain("Made with The Mini Mainframe");
    expect(out).toContain("# Unpublished");
    // Hex should be normalised to uppercase.
    expect(out).toContain("`#5D3618`");
  });

  test("renders empty fallback when no slots are recorded", () => {
    const out = recipeToMarkdown({
      recipe: { name: "Bare", bodyType: "infantry", notesMd: null },
      slots: [],
    });
    expect(out).toContain("## Slots");
    expect(out).toContain("_(no slots recorded)_");
  });

  test("paint with a name but no brand renders without a brand prefix", () => {
    const out = recipeToMarkdown({
      recipe: { name: "Brandless", bodyType: "infantry", notesMd: null },
      slots: [
        {
          technique: "basecoat",
          paintName: "My Custom Green",
          paintBrand: null,
          hex: "#1f8044",
          notesMd: null,
        },
      ],
    });
    expect(out).toContain("**Basecoat** — My Custom Green `#1F8044`");
    expect(out).not.toContain("null My Custom Green");
  });

  test("whitespace-only hex is treated as no hex", () => {
    const out = recipeToMarkdown({
      recipe: { name: "Blank hex", bodyType: "infantry", notesMd: null },
      slots: [
        {
          technique: "glaze",
          paintName: null,
          paintBrand: null,
          hex: "   ",
          notesMd: null,
        },
      ],
    });
    expect(out).toContain("**Glaze** — _(no paint chosen)_");
  });

  test("slot with no paint and no hex renders a placeholder", () => {
    const out = recipeToMarkdown({
      recipe: { name: "WIP", bodyType: "infantry", notesMd: null },
      slots: [
        {
          technique: "layer",
          paintName: null,
          paintBrand: null,
          hex: null,
          notesMd: null,
        },
      ],
    });
    expect(out).toContain("**Layer** — _(no paint chosen)_");
  });
});
