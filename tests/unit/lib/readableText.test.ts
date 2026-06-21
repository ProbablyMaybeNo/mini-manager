import { describe, expect, test } from "vitest";
import { readableText } from "@/lib/color";

/**
 * Swatch hex captions auto-pick black/white for legibility via YIQ perceived
 * brightness. WCAG-2 relative luminance mis-rates saturated colours — it scored
 * black marginally higher on bright red (which reads worse to the eye), so YIQ
 * is used: saturated reds/blues get white, genuinely light swatches get black.
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

describe("readableText — perceptual (YIQ) swatch caption colour", () => {
  test("saturated reds get white (Metallic Red); light muted swatches get black", () => {
    expect(readableText("#F20D0D")).toBe("#ffffff"); // bright red — white reads better
    expect(readableText("#c01010")).toBe("#ffffff");
    expect(readableText("#6E99C9")).toBe("#000000"); // light muted blue — black reads better
  });

  test("dark swatches get white", () => {
    for (const hex of ["#13243a", "#8a1f1f", "#3a6ea5"]) {
      expect(readableText(hex)).toBe("#ffffff");
    }
  });

  test("light swatches get black", () => {
    for (const hex of ["#51fd80", "#eef996", "#9fc6ee", "#ff9d3c"]) {
      expect(readableText(hex)).toBe("#000000");
    }
  });

  test("chosen caption clears AA (>=4.5) across the spread; saturated reds are the known YIQ exception (>=4.0)", () => {
    const spread = [
      "#000000", "#ffffff", "#808080", "#6E99C9", "#13243a", "#3a6ea5",
      "#9fc6ee", "#8a1f1f", "#51fd80", "#eef996", "#00d2ff", "#9b80dc", "#ff9d3c",
    ];
    for (const hex of spread) {
      expect(chosenContrast(hex)).toBeGreaterThanOrEqual(4.5);
    }
    // Pure saturated bright reds: YIQ prefers white for legibility even though it
    // lands just under strict AA — no colour both reads well AND clears 4.5 here.
    for (const hex of ["#F20D0D", "#c01010"]) {
      expect(chosenContrast(hex)).toBeGreaterThanOrEqual(4.0);
    }
  });

  test("falls back to white for an unparseable hex", () => {
    expect(readableText("nope")).toBe("#ffffff");
  });
});
