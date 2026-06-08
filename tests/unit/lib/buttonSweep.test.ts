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
  // UX-002 — the projects QuickAddBar is the DASHBOARD's single dominant
  // CTA, so it is the documented exception to the ADD→success rule: it
  // takes the cyan PRIMARY tier (asserted separately in DOMINANT_PRIMARY
  // below) so each page has exactly one cyan lead action. Every other
  // ADD/CREATE/NEW button stays green (success).
  {
    label: "AddBar (collections)",
    file: "src/components/collections/AddBar.tsx",
    expected: "success",
    signature: 'aria-label="Add to collection"',
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

/**
 * UX-002 — the single dominant CTA per primary surface carries the cyan
 * PRIMARY tier (DESIGN_LANGUAGE §4: exactly one cyan-solid lead per view).
 * These three are the page leads on the Dashboard, Recipes list, and
 * Recipe editor respectively. Locks them so a future sweep doesn't demote
 * them back to green and leave a view with no cyan anchor.
 */
const DOMINANT_PRIMARY: ReadonlyArray<VariantExpectation> = [
  {
    label: "QuickAddBar (projects) — dashboard lead",
    file: "src/components/QuickAddBar.tsx",
    expected: "primary",
    signature: 'aria-label="Add project"',
  },
  {
    label: "RecipeActionsBar Save — recipe editor lead",
    file: "src/components/recipes/RecipeActionsBar.tsx",
    expected: "primary",
    signature: "Save to your recipe library (detach from project)",
  },
];

describe("UX-002 — dominant CTA per surface → primary (cyan)", () => {
  for (const e of DOMINANT_PRIMARY) {
    test(`${e.label} uses variant='primary'`, () => {
      const src = read(e.file);
      const idx = src.indexOf(e.signature);
      expect(idx).toBeGreaterThan(0);
      const window = src.slice(Math.max(0, idx - 400), idx + 200);
      expect(window).toMatch(/variant="primary"/);
    });
  }

  test("NewRecipeButton (recipes list lead) maps the primary tier to cyan", () => {
    // This call site uses a ternary (variant === "primary" ? "primary" :
    // "ghost") rather than a literal prop, so assert the mapping directly.
    const src = read("src/components/recipes/NewRecipeButton.tsx");
    expect(src).toMatch(/variant === "primary" \? "primary" : "ghost"/);
  });
});

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
