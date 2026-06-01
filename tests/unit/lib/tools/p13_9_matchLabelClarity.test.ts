/**
 * P13.9 — Relabel `ΔE` jargon to `MATCH` (and remove the prefix from
 * row values). Ross asked "what does these denote? (triangle)E 0.5".
 * The metric is CIE ΔE 2000 (perceptual colour distance); the value
 * stays visible but is now plain ("0.5") with a tooltip that explains
 * the scale without forcing the painter to know the jargon.
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

describe("P13.9 — Match results column header reads MATCH", () => {
  const src = read("src/components/tools/match/MatchClient.tsx");

  test("column header renders the word MATCH, not ΔE", () => {
    // The column header `<span>` body. Pre-P13.9 was `<span>ΔE</span>`.
    expect(src).toMatch(/<span>MATCH<\/span>/);
    expect(src).not.toMatch(/<span>ΔE<\/span>/);
  });

  test("column header tooltip explains the scale in plain prose", () => {
    expect(src).toContain(
      '0 = exact match, ≤2 = imperceptible, >5 = noticeably different. Industry standard (CIE ΔE 2000).',
    );
  });

  test("column header aria-label drops the ΔE wording", () => {
    expect(src).toMatch(/aria-label="Match closeness/);
    expect(src).not.toMatch(/aria-label="ΔE colour difference"/);
  });
});

describe("P13.9 — Result row drops the `ΔE` prefix on the value", () => {
  const src = read("src/components/tools/match/MatchResultsRow.tsx");

  test("row value is just the number, not 'ΔE 0.5'", () => {
    expect(src).toMatch(/\{deltaE\.toFixed\(1\)\}/);
    // The legacy `ΔE {deltaE.toFixed(1)}` is gone.
    expect(src).not.toMatch(/ΔE \{deltaE\.toFixed\(1\)\}/);
  });

  test("row value carries the same plain-prose tooltip as the header", () => {
    expect(src).toContain(
      '0 = exact match, ≤2 = imperceptible, >5 = noticeably different. Industry standard (CIE ΔE 2000).',
    );
  });
});

describe("P13.9 — Sweep other UI surfaces that displayed `ΔE`", () => {
  test("Wheel SwatchActions row drops the ΔE prefix + adds tooltip", () => {
    const src = read("src/components/tools/wheel/SwatchActions.tsx");
    expect(src).not.toMatch(/ΔE \{r\.deltaE\.toFixed\(1\)\}/);
    expect(src).toMatch(/\{r\.deltaE\.toFixed\(1\)\}/);
    expect(src).toMatch(/title="Match closeness/);
  });

  test("Eyedropper closest-paint subrow drops the ΔE prefix + adds tooltip", () => {
    const src = read("src/components/tools/eyedropper/EyedropperClient.tsx");
    expect(src).not.toMatch(/ΔE \{r\.deltaE\.toFixed\(1\)\}/);
    expect(src).toMatch(/\{r\.deltaE\.toFixed\(1\)\}/);
    expect(src).toMatch(/title="Match closeness/);
  });

  test("Gradient RampDisplay tooltip uses 'match' wording, not 'ΔE'", () => {
    const src = read("src/components/tools/gradient/RampDisplay.tsx");
    // Tooltip still includes the score; the prefix flips from `ΔE` to `match`.
    expect(src).toMatch(/match \$\{s\.match\.deltaE\.toFixed\(1\)\}/);
    expect(src).not.toMatch(/ΔE \$\{s\.match\.deltaE\.toFixed\(1\)\}/);
  });
});
