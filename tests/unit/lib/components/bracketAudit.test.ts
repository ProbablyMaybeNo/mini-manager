/**
 * P11.11 — App-wide bracket-as-chrome audit.
 *
 * Brackets remain only on data (numeric cells like `[24]`, hex literals,
 * log tags rendered through `<LogTag/>` which owns the chrome, status
 * pills via the bordered StatusPill primitive). Decorative bracket
 * usage on buttons, headings, panels, error markers → gone.
 *
 * Tests scan source files for the patterns we deliberately retired so
 * a future commit can't quietly bring the chrome back.
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

const BRACKET_BANG_PATTERN = /\[\s*!\s*\]/;
const BRACKET_CHECKED_PATTERN = /"\[x\]"|'\[x\]'/;
const BRACKET_DECORATIVE_PATTERN = /"\[ [A-Za-z]/;

const ERROR_MARKER_FILES = [
  "src/components/library/InventoryControls.tsx",
  "src/components/recipes/CloneButton.tsx",
  "src/components/recipes/QrCode.tsx",
  "src/components/user/ExportButton.tsx",
  "src/components/wishlist/MarkBoughtModal.tsx",
  "src/components/wishlist/QuickAddBar.tsx",
  "src/components/wishlist/WishlistDetailDrawer.tsx",
];

describe("Error markers — `[ ! ] {error}` retired (P11.11)", () => {
  for (const file of ERROR_MARKER_FILES) {
    test(`${file} no longer uses bracket-bang chrome`, () => {
      const src = read(file);
      expect(src).not.toMatch(BRACKET_BANG_PATTERN);
    });

    test(`${file} imports + uses the LogTag primitive instead`, () => {
      const src = read(file);
      expect(src).toContain("LogTag");
    });
  }
});

describe("Checkbox markers — `[x]` / `[ ]` retired (P11.11)", () => {
  // P13.4 — NamedModelRow.tsx removed (named-models entity dropped).
  const checkboxFiles = [
    "src/components/NewProjectForm.tsx",
    "src/components/recipes/PaintSlotPicker.tsx",
  ];

  for (const file of checkboxFiles) {
    test(`${file} no longer renders "[x]" / "[ ]" as checkbox markers`, () => {
      const src = read(file);
      expect(src).not.toMatch(BRACKET_CHECKED_PATTERN);
      // `[ ]` literal also gone.
      expect(src).not.toMatch(/"\[ \]"/);
    });
  }
});

describe("Decorative JSX bracket text retired (P11.11)", () => {
  test("eyedropper drop zone no longer reads `[ Drop image here ]`", () => {
    const src = read("src/components/tools/eyedropper/DropZone.tsx");
    expect(src).not.toMatch(/\[ Drop image here \]/);
    expect(src).toMatch(/Drop image here/);
  });

  test("no source file under src/ contains a decorative-bracket string literal", () => {
    // Walk every .tsx file under src/components + src/app/(non-route)
    // and confirm no `"[ Word…"` patterns survive in JSX text. We
    // skip code comments + path-style refs by anchoring on `"[ ` only.
    const surfaces: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && entry.name.endsWith(".tsx")) surfaces.push(p);
      }
    }
    walk(path.resolve(__dirname, "../../../../src"));
    for (const file of surfaces) {
      const src = fs.readFileSync(file, "utf-8");
      // Strip line-comments + block-comments before scanning so we
      // don't trip on jsdoc references like `* The "[ Send to recipe ]"`.
      const stripped = src
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(stripped, `${file} should not carry decorative-bracket text`).not.toMatch(
        BRACKET_DECORATIVE_PATTERN,
      );
    }
  });
});
