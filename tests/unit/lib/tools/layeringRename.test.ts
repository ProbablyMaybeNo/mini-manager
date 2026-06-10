/**
 * P12.14 — Gradient → Layering UI string flip.
 *
 * URL stays /tools/gradient + the underlying toolId stays 'gradient'
 * for back-compat with palette source records + the existing
 * /tools/gradient route. Only the visible labels flip.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("Layering rename — visible labels", () => {
  test("tools index card title reads 'Color stacking' (FIGMA §6)", () => {
    const src = read("src/app/tools/page.tsx");
    expect(src).toContain('title: "Color stacking"');
    expect(src).not.toContain('title: "Gradient Builder"');
  });

  test("GradientClient h1 reads LAYERING", () => {
    const src = read("src/components/tools/gradient/GradientClient.tsx");
    expect(src).toContain('"text-3xl tracking-wide">LAYERING<');
    expect(src).not.toContain('"text-3xl tracking-wide">GRADIENT<');
  });

  test("default palette name is 'Layering ramp'", () => {
    const src = read("src/components/tools/gradient/GradientClient.tsx");
    expect(src).toContain("Layering ramp");
  });

  test("SendToRecipeModal TOOL_LABEL renames gradient -> Layering", () => {
    const src = read("src/components/tools/SendToRecipeModal.tsx");
    expect(src).toMatch(/gradient:\s*"Layering"/);
  });

  test("ToolFooterActions label switch returns 'Layering' for gradient", () => {
    const src = read("src/components/tools/ToolFooterActions.tsx");
    expect(src).toMatch(/case\s*"gradient":[\s\S]{0,200}"Layering"/);
  });
});

describe("Layering rename — toolId / URL back-compat", () => {
  test("/tools/gradient page route is unchanged", () => {
    expect(() => read("src/app/tools/gradient/page.tsx")).not.toThrow();
  });

  test("the toolId stays 'gradient' in TOOL_LABEL keys", () => {
    const src = read("src/components/tools/SendToRecipeModal.tsx");
    // Key stays as 'gradient' (the union literal); only the VALUE flips.
    expect(src).toContain('gradient: "Layering"');
  });
});
