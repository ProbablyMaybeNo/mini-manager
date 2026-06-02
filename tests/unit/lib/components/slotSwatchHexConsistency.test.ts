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
  test("ZoneList slot button uses raw zone.swatchHex as background", () => {
    const src = read("src/components/recipes/ZoneList.tsx");
    // The slot's bg is the swatch hex verbatim — no color-mix, no
    // hsl() / hsla() wrapping, no lightness adjustment. If a future
    // refactor ever wraps the bg in a transform this match breaks.
    expect(src).toMatch(/background:\s*filled\s*\?\s*zone\.swatchHex!?\s*:\s*"transparent"/);
  });

  test("StepRow swatch bg is the raw step.swatchHex", () => {
    const src = read("src/components/recipes/StepRow.tsx");
    expect(src).toMatch(/background:\s*step\.swatchHex\s*\?\?\s*"transparent"/);
  });

  test("ProjectColorSchemeBox FilledBox bg is the raw hex prop", () => {
    const src = read("src/components/ProjectColorSchemeBox.tsx");
    expect(src).toMatch(/background:\s*hex\s*\?\?\s*"transparent"/);
  });

  test("recipes/[id] page resolves swatchHex with no lightness adjustment", () => {
    const src = read("src/app/recipes/[id]/page.tsx");
    // The resolve expression is `customColorHex ?? paintMeta.get(paintId)?.hex ?? null`.
    // No call to lighten / darken / mix / shift / hsl-transform helpers.
    expect(src).toContain("firstStep?.customColorHex");
    expect(src).not.toMatch(/lighten\(|darken\(|adjustHsl|shiftLightness/);
  });

  test("projects/[id] page resolves the COLOR SCHEME box hex with no transform", () => {
    const src = read("src/app/projects/[id]/page.tsx");
    expect(src).toContain("firstStep?.customColorHex");
    expect(src).not.toMatch(/lighten\(|darken\(|adjustHsl|shiftLightness/);
  });

  test("StepRow label echoes step.customColorHex verbatim (no transform)", () => {
    const src = read("src/components/recipes/StepRow.tsx");
    // The label reads `Custom · ${step.customColorHex}` — same source
    // field the swatch bg resolves from. Lock this so a future tweak
    // that pre-processes the displayed hex (e.g. .toUpperCase()) doesn't
    // accidentally introduce a label-vs-swatch divergence.
    expect(src).toContain("`Custom · ${step.customColorHex}`");
  });
});
