/**
 * UX-905 — ColorPickerDialog never renders a duplicate title.
 *
 * The dialog's header bar already shows `contextLabel` (e.g. "MATCH
 * TARGET"). Before the fix, the dialog ALSO forwarded `contextLabel`
 * to the inner ColorPicker primitive, which rendered the same string
 * a second time as a `.section-title` underneath the header.
 *
 * Lock: ColorPickerDialog must NOT forward `contextLabel` to the inner
 * `<ColorPicker>`. The header is the single source of truth for the
 * dialog title; the picker's own contextLabel rendering is reserved
 * for the side-panel consumers in ProjectColorSchemeBox / ZoneList
 * which already pass `contextLabel={undefined}` to avoid the dupe.
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

describe("ColorPickerDialog — duplicate title removed (UX-905)", () => {
  const src = read("src/components/ui/ColorPickerDialog.tsx");

  test("dialog header still receives contextLabel as the visible heading", () => {
    // Header bar still shows contextLabel — that part doesn't change.
    expect(src).toMatch(/contextLabel\s*\?\?\s*"Pick a colour"/);
  });

  test("the inner <ColorPicker> is no longer passed contextLabel", () => {
    // Match the JSX block opening <ColorPicker until its closing /> and
    // assert contextLabel is not forwarded inside it.
    const block = src.match(/<ColorPicker\b[\s\S]*?\/>/);
    expect(block).not.toBeNull();
    expect(block?.[0]).not.toMatch(/contextLabel/);
  });

  test("dialog still exposes contextLabel as the modal aria-label", () => {
    // AT users still get the contextual label via aria — the dupe was
    // only a visual one. Keep this wired so we don't regress a11y.
    expect(src).toMatch(/aria-label=\{contextLabel\s*\?\?\s*"Pick a colour"\}/);
  });
});
