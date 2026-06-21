import { describe, expect, test } from "vitest";
import { readableText } from "@/lib/color";

/**
 * UX-008 — swatch hex-code captions auto-pick black/white for legibility.
 * The old 0.4 luminance cut chose white on mid-luminance swatches, failing
 * WCAG AA (#6E99C9 → 2.97:1, #F20D0D → 4.34:1). These tests pin that the
 * chosen text colour clears 4.5:1 on the two reported failures and across a
 * spread of swatches, so a future threshold tweak is a reviewed change.
 */
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between the chosen text colour and the swatch background. */
function chosenContrast(bgHex: string): number {
  const bg = relLuminance(bgHex);
  const fg = readableText(bgHex) === "#000000" ? 0 : 1;
  const [hi, lo] = bg > fg ? [bg, fg] : [fg, bg];
  return (hi + 0.05) / (lo + 0.05);
}

describe("readableText — WCAG-AA swatch caption contrast (UX-008)", () => {
  test("the two reported failures now clear AA with black text", () => {
    expect(readableText("#6E99C9")).toBe("#000000");
    expect(readableText("#F20D0D")).toBe("#000000");
    expect(chosenContrast("#6E99C9")).toBeGreaterThanOrEqual(4.5);
    expect(chosenContrast("#F20D0D")).toBeGreaterThanOrEqual(4.5);
  });

  test("dark swatches keep white text and still clear AA", () => {
    expect(readableText("#13243a")).toBe("#ffffff");
    expect(readableText("#8a1f1f")).toBe("#ffffff");
    expect(readableText("#3a6ea5")).toBe("#ffffff");
    for (const hex of ["#13243a", "#8a1f1f", "#3a6ea5"]) {
      expect(chosenContrast(hex)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("light swatches keep black text", () => {
    expect(readableText("#51fd80")).toBe("#000000");
    expect(readableText("#eef996")).toBe("#000000");
    expect(readableText("#9fc6ee")).toBe("#000000");
  });

  test("every chosen caption colour clears AA across a hue/lightness spread", () => {
    const sample = [
      "#000000", "#ffffff", "#808080", "#6E99C9", "#F20D0D", "#13243a",
      "#3a6ea5", "#9fc6ee", "#8a1f1f", "#c01010", "#51fd80", "#eef996",
      "#00d2ff", "#9b80dc", "#ff9d3c",
    ];
    for (const hex of sample) {
      expect(chosenContrast(hex)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("falls back to white for an unparseable hex", () => {
    expect(readableText("nope")).toBe("#ffffff");
  });
});
