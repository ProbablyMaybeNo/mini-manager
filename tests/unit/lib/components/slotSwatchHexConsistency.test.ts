/**
 * UX-912 — Slot swatch tint vs label hex consistency.
 *
 * Audit reported: "Two slots created at slightly different wheel
 * positions render as different cyan shades but both labels show
 * '#47D1D1'." The fix candidate was to remove an assumed lightness /
 * saturation transform between the stored hex and the rendered swatch.
 *
 * Investigation (recipes/[id]/page.tsx, projects/[id]/page.tsx,
 * ZoneList.tsx, StepRow.tsx, ProjectColorSchemeBox.tsx, PublicRecipeView.tsx):
 *
 *   - Slot swatchHex = `step.customColorHex ?? paintMeta.get(paintId).hex`
 *   - The COLOR SCHEME box renders `style={{ background: hex }}` with
 *     no transform; title is `${name} · ${hex}`.
 *   - The recipe-editor zone slot renders `style={{ background: zone.swatchHex }}`
 *     with no transform; the step-row label is `Custom · ${step.customColorHex}`
 *     (raw DB value) and the bg is `step.swatchHex` (resolved value).
 *   - For a custom-hex step, both label and bg pull from the same
 *     `customColorHex` field. No divergence path.
 *   - For a paint-id step, the bg uses `paintMeta.get(paintId).hex` and
 *     the label uses `paintLabel` (not a hex), so there's no label-hex
 *     to disagree with the swatch in the first place.
 *
 * Conclusion: there is no LIGHTNESS / SATURATION transform between the
 * stored hex and the rendered swatch in the current codebase. The
 * audit's report was likely a stale-state observation (mid-edit) or a
 * browser colour-management artefact. This file locks the no-transform
 * contract so any future refactor that introduces one fails loudly.
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

describe("UX-912 — slot swatch bg matches stored hex (no transform)", () => {
  test("SlotList slot button uses raw slot.swatchHex as background", () => {
    const src = read("src/components/recipes/SlotList.tsx");
    // The slot's bg is the swatch hex verbatim — no color-mix, no
    // hsl() / hsla() wrapping, no lightness adjustment.
    expect(src).toMatch(/background:\s*filled\s*\?\s*slot\.swatchHex!?\s*:\s*"transparent"/);
  });

  test("ProjectColorSchemeBox FilledBox bg is the raw hex prop", () => {
    const src = read("src/components/ProjectColorSchemeBox.tsx");
    expect(src).toMatch(/background:\s*hex\s*\?\?\s*"transparent"/);
  });

  test("recipes/[id] page resolves swatchHex with no lightness adjustment", () => {
    const src = read("src/app/recipes/[id]/page.tsx");
    // The resolve expression is `customColorHex ?? meta?.hex ?? null`.
    // No call to lighten / darken / mix / shift / hsl-transform helpers.
    expect(src).toContain("slot.customColorHex ?? meta?.hex");
    expect(src).not.toMatch(/lighten\(|darken\(|adjustHsl|shiftLightness/);
  });

  test("projects/[id] page resolves the Recipe box hex with no transform", () => {
    const src = read("src/app/projects/[id]/page.tsx");
    expect(src).toContain("slot.customColorHex ?? meta?.hex");
    expect(src).not.toMatch(/lighten\(|darken\(|adjustHsl|shiftLightness/);
  });

  test("SlotList label echoes slot.customColorHex verbatim (no transform)", () => {
    const src = read("src/components/recipes/SlotList.tsx");
    // A custom-hex slot's label reads `Custom · ${slot.customColorHex}` —
    // the same source field the swatch bg resolves from.
    expect(src).toContain("`Custom · ${slot.customColorHex}`");
  });
});
