/**
 * P14.7 — Inspo gallery widget render integration.
 *
 * Same source-string pattern the calendar widget uses — client
 * components with useState/useTransition/useRouter can't be driven
 * through React in the unit env (no fiber). Server actions are
 * exercised in tests/integration/actions/inspoImages.test.ts.
 *
 * Pins:
 *   - 2-column mobile / 3-column desktop grid (Notion-style)
 *   - external <img src> render, NO storage / NO proxy
 *   - empty-state copy preserved verbatim
 *   - "Add inspo" form below the grid
 *   - "Manage" button opens the modal
 *   - solid-fill Button discipline (no cyan, no [ ] brackets)
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("InspoGalleryGrid structure (P14.7)", () => {
  const src = read("src/components/planner/InspoGalleryGrid.tsx");

  test("uses a 2-col mobile / 3-col desktop grid", () => {
    expect(src).toContain("grid-cols-2");
    expect(src).toContain("md:grid-cols-3");
  });

  test("renders each url via plain <img src={url}> — no proxy, no Next/Image", () => {
    expect(src).toMatch(/<img[^>]+src=\{img\.url\}/);
    expect(src).not.toMatch(/from\s+["']next\/image["']/);
  });

  test("falls back to alt text when supplied, neutral default otherwise", () => {
    expect(src).toMatch(/img\.altText\s*\?\?\s*["']Inspo reference["']/);
  });

  test("uses lazy loading on every gallery <img>", () => {
    expect(src).toMatch(/loading=["']lazy["']/);
  });

  test("renders empty-state copy with the locked Pinterest/IG/ArtStation wording", () => {
    expect(src).toMatch(/Pinterest, Instagram, or ArtStation/);
    expect(src).toMatch(/reference board/);
  });

  test("mounts the AddInspoForm + Manage modal trigger", () => {
    expect(src).toContain("<AddInspoForm");
    expect(src).toContain("ManageInspoModal");
    expect(src).toMatch(/Manage/);
  });

  test("grid <ul> has an aria-label so the gallery is discoverable", () => {
    expect(src).toMatch(/aria-label=["']Inspo gallery["']/);
  });
});

describe("AddInspoForm structure (P14.7)", () => {
  const src = read("src/components/planner/AddInspoForm.tsx");

  test("calls addInspoImage server action on submit", () => {
    expect(src).toContain('from "@/lib/actions/inspoImages"');
    expect(src).toMatch(/addInspoImage\(/);
  });

  test("has URL + alt text controls", () => {
    expect(src).toMatch(/type=["']url["']/);
    expect(src).toMatch(/type=["']text["']/);
  });

  test("never fetches the URL on the client (paste-only contract)", () => {
    // No fetch / no <Image> / no proxy helper. The widget only
    // submits the typed URL to the server action.
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/next\/image/);
  });

  test("uses solid-fill success variant for the Add button (P13.1 — CREATE intent)", () => {
    expect(src).toMatch(/variant=["']success["']/);
  });
});

describe("ManageInspoModal structure (P14.7)", () => {
  const src = read("src/components/planner/ManageInspoModal.tsx");

  test("imports every per-row server action", () => {
    expect(src).toContain('from "@/lib/actions/inspoImages"');
    expect(src).toMatch(/deleteInspoImage/);
    expect(src).toMatch(/reorderInspoImages/);
    expect(src).toMatch(/toggleInspoDisplay/);
  });

  test("renders show / hide toggle + delete affordances per row", () => {
    expect(src).toMatch(/Hide/);
    expect(src).toMatch(/Show/);
    expect(src).toMatch(/variant=["']danger["'][\s\S]*?>\s*Delete\s*</);
  });

  test("wires native HTML5 drag-and-drop for reorder", () => {
    expect(src).toMatch(/draggable/);
    expect(src).toMatch(/onDragStart/);
    expect(src).toMatch(/onDragOver/);
    expect(src).toMatch(/onDragEnd/);
  });

  test("has 'Save order' + 'Close' actions on the modal header", () => {
    expect(src).toMatch(/Save order/);
    expect(src).toMatch(/Close/);
  });

  test("renders the dialog with aria-modal + role='dialog'", () => {
    expect(src).toMatch(/role=["']dialog["']/);
    expect(src).toMatch(/aria-modal=["']true["']/);
  });

  test("P14.8 — modal goes full-screen on mobile, constrained at sm+", () => {
    // Mobile: panel takes w-full + h-full (no max bounds).
    expect(src).toContain("w-full h-full");
    // sm+ restores the constrained dialog (max-width + max-height +
    // float-with-backdrop padding).
    expect(src).toContain("sm:max-w-2xl");
    expect(src).toContain("sm:max-h-[90vh]");
    expect(src).toContain("sm:p-4");
    // Backdrop centers vertically on sm+, stretches edge-to-edge
    // (items-stretch) on mobile so the modal fills the viewport.
    expect(src).toContain("items-stretch");
    expect(src).toContain("sm:items-center");
  });
});

describe("Inspo widget discipline (P14.7)", () => {
  const files = [
    "src/components/planner/PlannerInspoCell.tsx",
    "src/components/planner/InspoGalleryGrid.tsx",
    "src/components/planner/AddInspoForm.tsx",
    "src/components/planner/ManageInspoModal.tsx",
  ];

  test("no raw hex literals across the inspo surface (forces @theme tokens)", () => {
    const hexLiteral = /#[0-9a-fA-F]{3,8}\b/;
    for (const rel of files) {
      const src = read(rel);
      const noComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/[^\n]*/g, "$1");
      expect(noComments, `raw hex in ${rel}`).not.toMatch(hexLiteral);
    }
  });

  test("no Inspo Button uses cyan (P13.1 ban on cyan action buttons)", () => {
    for (const rel of files) {
      const src = read(rel);
      expect(src).not.toMatch(/<Button[^>]+cyan/);
      expect(src).not.toMatch(/variant=["']cyan["']/);
    }
  });

  test("no Inspo surface uses bracketed [ FOO ] action labels (P13.1)", () => {
    for (const rel of files) {
      const src = read(rel);
      expect(src).not.toMatch(/>\s*\[\s*[A-Z][A-Z\s]*\s*\]\s*</);
    }
  });

  test("nothing in the inspo surface fetches the URL (paste-only contract)", () => {
    // The cell + grid + form + modal must never call fetch on the
    // pasted URL. The server action enforces the same rule, but the
    // client surface should never even try.
    for (const rel of files) {
      const src = read(rel);
      expect(src).not.toMatch(/\bfetch\(/);
      // No Next/Image — that would proxy through the Vercel image
      // optimiser, which counts as a fetch.
      expect(src).not.toMatch(/from\s+["']next\/image["']/);
    }
  });
});

describe("PlannerInspoCell wiring (P14.7)", () => {
  const src = read("src/components/planner/PlannerInspoCell.tsx");

  test("renders inside a Card titled INSPO with the cyan accent", () => {
    expect(src).toMatch(/title=["']INSPO["']/);
    expect(src).toMatch(/accentColor=["']cyan["']/);
  });

  test("reads displayed + full inspo lists via dedicated query helpers", () => {
    expect(src).toContain("listDisplayedInspoImages");
    expect(src).toContain("listAllInspoImages");
  });

  test("mounts the gallery grid", () => {
    expect(src).toContain("InspoGalleryGrid");
  });
});
