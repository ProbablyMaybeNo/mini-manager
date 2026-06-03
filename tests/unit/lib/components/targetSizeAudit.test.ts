/**
 * M1 — Foundations: target-size + type-floor audit (mobile UX/UI plan).
 *
 * Static source-scan regression net for the M1 acceptance criteria:
 *
 *   1. Type floor: editable fields (textarea / text inputs) on body
 *      content must not ship at text-2xs (11px) — 11px is reserved for
 *      true chrome/caps labels. The FocusPanel paint-note editor was the
 *      named offender (11px → 14px). This guards the regression.
 *
 *   2. Target audit: interactive controls the plan called out as
 *      sub-24px must carry the `.tap-target` floor (44px mobile / 32px
 *      desktop) — the FOCUS step-done checkbox, the library inventory
 *      toggles, and the library/view inline toggles. A future edit that
 *      strips `.tap-target` off these trips this net.
 *
 * Mirrors the existing buttonSweep.test.ts source-scan convention (node
 * env, fs.readFileSync) — no DOM, no dev server (deliberately: a prior
 * agent hung on `next dev`; tsc + vitest are the only gates).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

/** Pull the className-ish window around a signature so we can assert on
 *  the classes applied to the same element without matching the whole
 *  file. */
function windowAround(src: string, signature: string, before = 600, after = 400): string {
  const idx = src.indexOf(signature);
  expect(idx, `signature not found: ${signature}`).toBeGreaterThan(-1);
  return src.slice(Math.max(0, idx - before), idx + after);
}

describe("M1 type floor — editable fields ≥ 14px", () => {
  test("FocusPanel paint-note textarea is not text-2xs (11px)", () => {
    const src = read("src/components/focus/FocusPanel.tsx");
    // Locate the textarea element by its placeholder, then assert its
    // own class string uses text-sm and NOT text-2xs.
    const win = windowAround(
      src,
      'placeholder="Note for this paint (mix, brand sub, technique)…"',
      400,
      400,
    );
    expect(win).toMatch(/text-sm/);
    // The textarea's own className block must not carry the 11px token.
    // (text-2xs may still appear elsewhere in the file for chrome labels.)
    const taIdx = src.indexOf("<textarea");
    const taEnd = src.indexOf("/>", taIdx);
    const textareaTag = src.slice(taIdx, taEnd);
    expect(textareaTag).not.toMatch(/text-2xs/);
  });
});

interface TapTargetExpectation {
  label: string;
  file: string;
  /** A stable substring on the interactive element. */
  signature: string;
}

const TAP_TARGET_GUARDS: ReadonlyArray<TapTargetExpectation> = [
  {
    label: "FOCUS step-done checkbox",
    file: "src/components/focus/StepCompletionCheckbox.tsx",
    signature: 'type="checkbox"',
  },
  {
    label: "Library inventory owned toggle",
    file: "src/components/library/InventoryControls.tsx",
    signature: 'min-h-[40px]',
  },
  {
    label: "Library view-mode toggle",
    file: "src/components/library/ViewModeToggle.tsx",
    signature: "inline-flex items-center justify-center gap-1.5",
  },
];

describe("M1 target audit — named sub-24px controls carry .tap-target", () => {
  for (const g of TAP_TARGET_GUARDS) {
    test(`${g.label} keeps .tap-target`, () => {
      const src = read(g.file);
      expect(src, `${g.file} missing .tap-target`).toMatch(/tap-target/);
      // And the floor sits near the interactive signature, not in a
      // stray comment elsewhere.
      const win = windowAround(src, g.signature, 600, 200);
      expect(win).toMatch(/tap-target/);
    });
  }
});
