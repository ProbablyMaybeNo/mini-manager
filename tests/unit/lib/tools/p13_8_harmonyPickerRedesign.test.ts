/**
 * P13.8 — Colour wheel harmony picker redesigned as stacked rows.
 *
 * Ross's complaint: the old wrap of 8 outlined chips was "jumbled and
 * hard to read" — the chip text was the only information channel, no
 * visual preview of what the harmony would produce. New layout: one
 * row per harmony with a swatch-strip preview + name + description +
 * swatch count. Active row uses solid-fill green per P13.1 discipline.
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

const pickerSrc = read("src/components/tools/wheel/HarmonyPicker.tsx");
const clientSrc = read("src/components/tools/wheel/WheelClient.tsx");

describe("P13.8 — HarmonyPicker is a stacked-row list, not a chip wrap", () => {
  test("renders space-y rows (vertical stack), not flex flex-wrap", () => {
    expect(pickerSrc).toContain('className="space-y-1.5"');
    // Top-level container must NOT be the legacy flex flex-wrap pattern.
    expect(pickerSrc).not.toMatch(/className="flex flex-wrap gap-1\.5"\s*[\s\S]{0,40}role="radiogroup"/);
  });

  test("each row is a full-width <button> with role='radio'", () => {
    expect(pickerSrc).toMatch(/role="radio"/);
    expect(pickerSrc).toMatch(/w-full flex items-center gap-3/);
  });

  test("preserves radiogroup semantics on the wrapper", () => {
    expect(pickerSrc).toMatch(/role="radiogroup"[\s\S]{0,80}aria-label="Harmony mode"/);
  });
});

describe("P13.8 — Each row renders a swatch-strip preview", () => {
  test("imports buildHarmony so previews track the primary HSL", () => {
    expect(pickerSrc).toContain("buildHarmony");
  });

  test("accepts a primary prop with hue/saturation/lightness", () => {
    expect(pickerSrc).toMatch(/primary\?:\s*\{\s*hue:\s*number;\s*saturation:\s*number;\s*lightness:\s*number\s*\}/);
  });

  test("renders each preview hex as a flex-1 segment", () => {
    expect(pickerSrc).toMatch(/previewHexes\.map[\s\S]{0,300}background:\s*hex/);
  });

  test("falls back to a neutral panel when primary is undefined", () => {
    expect(pickerSrc).toMatch(/previewHexes\.length > 0[\s\S]{0,400}bg-\[var\(--color-bg-panel\)\]/);
  });
});

describe("P13.8 — Active row uses solid-fill green (P13.1 discipline)", () => {
  test("isActive maps to bg-[var(--color-green)] + text-black", () => {
    expect(pickerSrc).toMatch(/isActive[\s\S]{0,200}bg-\[var\(--color-green\)\][\s\S]{0,80}text-black/);
  });

  test("no longer uses glow-cyan / accent border for active state", () => {
    expect(pickerSrc).not.toContain("glow-cyan");
    expect(pickerSrc).not.toContain("border-[var(--color-accent)]");
  });
});

describe("P13.8 — WheelClient wires the primary prop", () => {
  test("HarmonyPicker is passed primary={hue, saturation, lightness}", () => {
    expect(clientSrc).toMatch(/<HarmonyPicker[\s\S]{0,300}primary=\{\s*\{\s*hue:[\s\S]{0,80}saturation:[\s\S]{0,80}lightness/);
  });

  test("the redundant description paragraph under the picker is removed", () => {
    // The legacy `{harmonyMeta.description}.` paragraph below the picker
    // is gone because every row now carries its own description inline.
    expect(clientSrc).not.toMatch(/<HarmonyPicker[\s\S]{0,500}\{harmonyMeta\.description\}\./);
  });
});

describe("P13.8 — No bracketed `[ ]` outline aesthetic in the picker", () => {
  test("no `[ ${label} ]` style remnant", () => {
    expect(pickerSrc).not.toMatch(/\[\s*\$\{h\.label\}\s*\]/);
  });
});
