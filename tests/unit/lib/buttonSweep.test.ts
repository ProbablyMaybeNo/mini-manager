/**
 * P12.24 — App-wide button colour-discipline sweep.
 *
 * Locks the variant assignment for high-traffic ADD / CREATE / NEW
 * buttons (success / green) and SHARE / IMPORT / EXPORT (warning /
 * yellow) against the rest of the locked palette discipline. This
 * regression net keeps a future commit from quietly drifting back to
 * the cyan-primary default — which led to the "cyan-on-cyan invisible
 * button" UX-V6-001 bug.
 *
 * Note: the sweep is iterative — this test covers the surfaces flipped
 * in this commit. Additional surfaces get added to the list as they
 * land.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../", rel),
    "utf-8",
  );
}

interface VariantExpectation {
  label: string;
  file: string;
  expected: "success" | "warning" | "primary" | "danger" | "purple";
  signature: string;
}

const ADD_CREATE_NEW_SUCCESS: ReadonlyArray<VariantExpectation> = [
  {
    label: "QuickAddBar (projects)",
    file: "src/components/QuickAddBar.tsx",
    expected: "success",
    signature: 'aria-label="Add project"',
  },
  {
    label: "QuickAddBar (wishlist)",
    file: "src/components/wishlist/QuickAddBar.tsx",
    expected: "success",
    signature: 'aria-label="Add wishlist item"',
  },
  // P13.4 — AddNamedModelForm removed (named_model entity dropped).
  {
    label: "NewProjectForm",
    file: "src/components/NewProjectForm.tsx",
    expected: "success",
    signature: '"Creating…" : "Create project"',
  },
  {
    label: "ProjectColorSchemeBox (+ Add paint)",
    file: "src/components/ProjectColorSchemeBox.tsx",
    expected: "success",
    signature: "+ Add paint",
  },
  {
    label: "CloneButton",
    file: "src/components/recipes/CloneButton.tsx",
    expected: "success",
    signature: "Clone to my recipes",
  },
  {
    label: "AttachRecipeModal create+attach",
    file: "src/components/recipes/AttachRecipeModal.tsx",
    expected: "success",
    signature: "Create & attach",
  },
  {
    label: "Import apply",
    file: "src/components/imports/ImportPreview.tsx",
    expected: "success",
    signature: "Apply → create projects",
  },
];

const SHARE_IMPORT_EXPORT_WARNING: ReadonlyArray<VariantExpectation> = [
  {
    label: "ShareModal Share via…",
    file: "src/components/recipes/ShareModal.tsx",
    expected: "warning",
    signature: "Share via…",
  },
  {
    label: "Import Choose file",
    file: "src/components/imports/ImportClient.tsx",
    expected: "warning",
    signature: '"Parsing…" : "Choose file"',
  },
  {
    label: "Import Parse list",
    file: "src/components/imports/ImportClient.tsx",
    expected: "warning",
    signature: '"Parsing…" : "Parse list"',
  },
  {
    label: "Export button",
    file: "src/components/user/ExportButton.tsx",
    expected: "warning",
    signature: "Export all my data",
  },
];

describe("P12.24 button sweep — ADD/CREATE/NEW → success", () => {
  for (const e of ADD_CREATE_NEW_SUCCESS) {
    test(`${e.label} uses variant='success'`, () => {
      const src = read(e.file);
      // Find the button signature, then look for variant="success" in a
      // small window around it.
      const idx = src.indexOf(e.signature);
      expect(idx).toBeGreaterThan(0);
      const window = src.slice(Math.max(0, idx - 400), idx + 200);
      expect(window).toMatch(/variant="success"/);
    });
  }
});

describe("P12.24 button sweep — SHARE/IMPORT/EXPORT → warning", () => {
  for (const e of SHARE_IMPORT_EXPORT_WARNING) {
    test(`${e.label} uses variant='warning'`, () => {
      const src = read(e.file);
      const idx = src.indexOf(e.signature);
      expect(idx).toBeGreaterThan(0);
      const window = src.slice(Math.max(0, idx - 400), idx + 200);
      expect(window).toMatch(/variant="warning"/);
    });
  }
});
