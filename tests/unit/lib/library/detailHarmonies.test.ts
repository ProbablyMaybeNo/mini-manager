/**
 * P12.22 — Paint detail panel harmonies dropdown.
 *
 * Replaces the static 8-HSL-rotation strip with a picker:
 *   - <select> for harmony scheme (mono / analogous / complementary /
 *     triadic / split / square / tetradic from the locked Phase-12 set)
 *   - row of harmony swatches (clickable)
 *   - inline library-paint matches below when a swatch is clicked
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

describe("PaintDetailPanel harmonies dropdown (P12.22)", () => {
  const src = read("src/components/library/PaintDetailPanel.tsx");

  test("imports the locked harmony helpers from src/lib/colorPicker", () => {
    expect(src).toContain("COLOR_PICKER_HARMONY_LABELS");
    expect(src).toContain("buildPickerHarmony");
    expect(src).toContain("fastMatchByHueBand");
  });

  test("renders a <select> for harmony scheme", () => {
    expect(src).toContain('id="paint-harmony-scheme"');
    expect(src).toContain("setHarmonyKey");
  });

  test("default harmony scheme is 'complementary'", () => {
    expect(src).toMatch(
      /useState<ColorPickerHarmony>\("complementary"\)/,
    );
  });

  test("the harmony swatches are clickable buttons (not static spans)", () => {
    // Old strip used <span>; new strip uses <button>.
    expect(src).toMatch(/role="option"/);
    expect(src).toMatch(/aria-selected=\{active\}/);
  });

  test("clicking a swatch records selectedHarmonyHex + renders library matches", () => {
    expect(src).toContain("setSelectedHarmonyHex");
    expect(src).toContain("harmonyPaintMatches");
    expect(src).toContain("fastMatchByHueBand(selectedHarmonyHex");
  });

  test("inline library matches list caps at 12 entries (max-h-40 + overflow)", () => {
    expect(src).toContain("limit: 12");
    expect(src).toMatch(/max-h-40 overflow-y-auto/);
  });

  test("hex match panel shows brand + paint name per match", () => {
    expect(src).toMatch(/Library matches for/);
    expect(src).toContain("p.brand");
    expect(src).toContain("p.name");
  });

  test("changing the scheme clears the selected swatch (fresh pick)", () => {
    // setHarmonyKey + setSelectedHarmonyHex(null) in the same handler.
    expect(src).toMatch(/setHarmonyKey[\s\S]{0,200}setSelectedHarmonyHex\(null\)/);
  });

  test("PaintDetailPanel takes an optional allPaints prop for the match list", () => {
    expect(src).toMatch(/allPaints\?:\s*ReadonlyArray<Paint>/);
  });
});

describe("LibraryPageClient passes allPaints into the detail panel", () => {
  const src = read("src/components/library/LibraryPageClient.tsx");

  test("PaintDetailPanel gets allPaints={paints}", () => {
    expect(src).toContain("allPaints={paints}");
  });
});
