/**
 * UX-906 — ColorPickerDialog initialises to the field's current value.
 *
 * Round-9 audit: opening the drawer after a previous session showed
 * the wheel hue + lightness slider + library search at the LAST
 * session's state instead of the current field value. Painter
 * couldn't tell their existing colour (`#072547`) was preserved if
 * they hit Close — the wheel was sitting on the previous session's
 * cyan (`#47D1D1`).
 *
 * Root cause: native <dialog> just toggles open/close on the same
 * mounted node, so the ColorPicker's internal hue/lightness/search/
 * eyedropper state survived across sessions. The picker's seedHsl is
 * derived correctly from `value?.hex`, but useState only reads it
 * once on mount.
 *
 * Fix: only render the picker when `open` is true AND key it on
 * `initialHex` — re-opening with a different field value triggers a
 * fresh mount with fresh state. Locked at source-level here so a
 * future refactor doesn't quietly drop the gate.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DIALOG = "src/components/ui/ColorPickerDialog.tsx";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("ColorPickerDialog — fresh mount per session (UX-906)", () => {
  const src = read(DIALOG);

  test("picker is only mounted while the dialog is open", () => {
    // Conditional render gated on `open` so closing the dialog
    // unmounts the picker and wipes its internal state.
    expect(src).toMatch(/\{open\s*\?\s*\(\s*<ColorPicker/);
  });

  test("picker carries a key derived from initialHex", () => {
    // The key forces React to discard the old picker fiber and
    // mount a fresh one whenever the painter opens the drawer on
    // a different field — wheel hue, lightness slider, library
    // search query, and eyedropper preview all reset cleanly.
    expect(src).toMatch(/key=\{initialHex\s*\?\?\s*"no-initial"\}/);
  });

  test("the value prop still flows from initialHex", () => {
    // Don't lose the seed wiring; the picker still seeds its
    // initial hue/lightness from the field value on first render.
    expect(src).toMatch(/value=\{initialHex\s*\?\s*\{\s*hex:\s*initialHex\s*\}\s*:\s*null\}/);
  });
});
