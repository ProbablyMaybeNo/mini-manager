/**
 * P11.1 — StageCounter readable-label contract.
 *
 * Locks the user-facing string + per-stage tone mappings so the
 * readability sweep doesn't silently regress. Stage labels render as
 * full mono-caps (BUILD / PRIME / PAINT / BASE / DONE); the keyboard
 * shortcut is a small dim annotation, not bracket chrome; per-stage
 * tone follows the 5-color palette (cyan early, yellow mid, green
 * complete).
 */
import { describe, expect, test } from "vitest";
import {
  PANEL_STAGES,
  STAGE_LABEL,
  STAGE_SHORTCUT,
  STAGE_TONE,
} from "@/components/stageCounterLabels";

describe("STAGE_LABEL — readable label contract (P11.1)", () => {
  test("build / prime / paint / base render full mono-caps", () => {
    expect(STAGE_LABEL.build).toBe("BUILD");
    expect(STAGE_LABEL.prime).toBe("PRIME");
    expect(STAGE_LABEL.paint).toBe("PAINT");
    expect(STAGE_LABEL.base).toBe("BASE");
  });

  test("complete reads as DONE (concrete-over-abstract)", () => {
    expect(STAGE_LABEL.complete).toBe("DONE");
  });

  test("owned reads as OWNED", () => {
    expect(STAGE_LABEL.owned).toBe("OWNED");
  });
});

describe("STAGE_SHORTCUT — keyboard shortcut annotation (P11.1)", () => {
  test("each panel stage has a single-letter shortcut glyph", () => {
    for (const stage of PANEL_STAGES) {
      expect(STAGE_SHORTCUT[stage]).toMatch(/^[A-Z]$/);
    }
  });

  test("shortcuts match the painter's B/P/A/S/C mental model", () => {
    expect(STAGE_SHORTCUT.build).toBe("B");
    expect(STAGE_SHORTCUT.prime).toBe("P");
    expect(STAGE_SHORTCUT.paint).toBe("A");
    expect(STAGE_SHORTCUT.base).toBe("S");
    expect(STAGE_SHORTCUT.complete).toBe("C");
  });
});

describe("STAGE_TONE — per-stage palette tone (P11.1)", () => {
  test("build + prime use cyan (early-stage / starting out)", () => {
    expect(STAGE_TONE.build).toContain("--color-cyan");
    expect(STAGE_TONE.prime).toContain("--color-cyan");
  });

  test("paint + base use pastel yellow (model on the desk)", () => {
    expect(STAGE_TONE.paint).toContain("--color-yellow");
    expect(STAGE_TONE.base).toContain("--color-yellow");
  });

  test("complete uses neon green (you've got this)", () => {
    expect(STAGE_TONE.complete).toContain("--color-green");
  });

  test("no raw hex — every tone goes through a CSS token", () => {
    for (const stage of PANEL_STAGES) {
      expect(STAGE_TONE[stage]).not.toMatch(/#[0-9a-fA-F]{3,}/);
      expect(STAGE_TONE[stage]).toMatch(/--color-/);
    }
  });
});
