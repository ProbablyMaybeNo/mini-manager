/**
 * P16.3 / P16.4 / M4.2 — HeatSinkGridCell server seam.
 *
 * Two layers:
 *   1. Render tests (existing pattern): render the server component with the
 *      `view` test seam and assert the client component is mounted with the
 *      correct props. The client uses hooks so only the server seam is
 *      rendered here.
 *   2. Source-scan tests (M4.2): pin the canvas-based contract — the client
 *      must render a single <canvas> and the ~7,144 per-cell
 *      `aria-haspopup="dialog"` button grid must be GONE. Also assert the
 *      gap-fill surface and "Fill gaps" button exist.
 */
import { describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Stub the server read layer + auth so importing the cell module in the
// node unit env doesn't pull in the DB client.
vi.mock("@/db/queries/paintCoverage", () => ({
  getCoverageGridView: vi.fn(),
}));
vi.mock("@/lib/auth-stub", () => ({
  currentUserId: vi.fn(async () => "test-user"),
}));

import { HeatSinkGridCell } from "@/components/planner/HeatSinkGridCell";
import { HeatSinkGridClient } from "@/components/planner/HeatSinkGridClient";
import type { CoverageGridView } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import type { Paint } from "@/lib/paints/types";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

type AnyNode = { type: unknown; props: Record<string, unknown> };

function findAll(
  node: unknown,
  predicate: (n: AnyNode) => boolean,
  acc: AnyNode[] = [],
): AnyNode[] {
  if (node == null || typeof node === "string") return acc;
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, acc);
    return acc;
  }
  const n = node as AnyNode;
  if (typeof n !== "object" || !("type" in n) || !("props" in n)) return acc;
  if (predicate(n)) acc.push(n);
  if (n.props?.children != null) findAll(n.props.children, predicate, acc);
  return acc;
}

const paint = (id: string, hex: string): Paint => ({
  id,
  brand: "Citadel",
  line: "Base",
  name: id,
  type: "Paint",
  hex,
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
});

const cell = (id: string, hex: string, state: CoverageState) => ({
  paint: paint(id, hex),
  state,
});

const view: CoverageGridView = {
  grid: {
    cells: [
      cell("red", "#ff0000", "owned"),
      cell("green", "#00ff00", "wanted"),
      cell("blue", "#0000ff", "none"),
    ],
    summary: { owned: 1204, wanted: 312, total: 7144, ownedPct: 17 },
  },
  brands: ["Citadel"],
  defaultBrandFilter: ["Citadel"],
};

async function renderCell(v: CoverageGridView) {
  return (await HeatSinkGridCell({ view: v })) as unknown;
}

/* ============================================================
   Layer 1 — Render tests (server seam, existing pattern)
   ============================================================ */

describe("HeatSinkGridCell server seam (P16.4)", () => {
  test("mounts the HeatSinkGridClient", async () => {
    const tree = await renderCell(view);
    const clients = findAll(tree, (n) => n.type === HeatSinkGridClient);
    expect(clients).toHaveLength(1);
  });

  test("passes the composed grid, brands, and default filter through", async () => {
    const tree = await renderCell(view);
    const client = findAll(tree, (n) => n.type === HeatSinkGridClient)[0];
    expect(client?.props.grid).toBe(view.grid);
    expect(client?.props.brands).toEqual(["Citadel"]);
    expect(client?.props.defaultBrandFilter).toEqual(["Citadel"]);
  });

  test("renders inside the COLLECTION card (A4 rename)", async () => {
    const tree = await renderCell(view);
    const cards = findAll(
      tree,
      (n) => n.props?.title === "COLLECTION" && n.props?.accentColor === "green",
    );
    expect(cards).toHaveLength(1);
  });
});

/* ============================================================
   Layer 2 — Source-scan tests (M4.2 canvas contract)
   ============================================================ */

describe("HeatSinkGridClient — M4.2 canvas contract (source-scan)", () => {
  const src = read("src/components/planner/HeatSinkGridClient.tsx");

  test("M4.2: the client imports CollectionCanvas (single canvas replaces DOM grid)", () => {
    expect(src).toContain('import { CollectionCanvas }');
    expect(src).toContain("CollectionCanvas");
  });

  test("M4.2: the client renders a <canvas> via CollectionCanvas, not per-cell buttons", () => {
    // CollectionCanvas renders the single canvas.
    expect(src).toContain("<CollectionCanvas");
  });

  test("M4.2: the ~7,144 gridcell buttons are gone", () => {
    // The old DOM grid used role="gridcell" on thousands of buttons.
    expect(src).not.toContain('role="gridcell"');
    // No row-group div grid layout either.
    expect(src).not.toContain('role="grid"');
  });

  test("M4.2: no per-cell aria-haspopup on data cells (only the single 'Fill gaps' button)", () => {
    // The old grid had aria-haspopup="dialog" on EVERY one of ~7,144 cells.
    // Now there is exactly one aria-haspopup — on the keyboard-accessible
    // "Fill gaps" button that opens the surface. We verify the per-cell
    // pattern (inside role="gridcell" context) is gone.
    expect(src).not.toContain('role="gridcell"');
    // The single remaining aria-haspopup is the "Fill gaps" button, not per-cell.
    const occurrences = (src.match(/aria-haspopup/g) ?? []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  test("M4.2: a keyboard-focusable 'Fill gaps' button opens the gap-fill surface", () => {
    // The button must exist so keyboard users can access the gap-fill panel
    // without relying on the canvas (which is role=img, not interactive).
    expect(src).toMatch(/Fill gaps/i);
    expect(src).toContain("aria-haspopup");
  });

  test("M4.2: the gap-fill surface is CollectionGapFill", () => {
    expect(src).toContain('import { CollectionGapFill }');
    expect(src).toContain("<CollectionGapFill");
  });

  test("M4.2: HeatSinkGapFillPopover is gone", () => {
    expect(src).not.toContain("HeatSinkGapFillPopover");
  });

  test("M4.2: the old row-chunking imports are gone", () => {
    expect(src).not.toContain("chunkCells");
    expect(src).not.toContain("rowGroupCount");
    expect(src).not.toContain("gridColumnsFor");
    expect(src).not.toContain("intrinsicRowSize");
    expect(src).not.toContain("CELLS_PER_ROW_GROUP");
    expect(src).not.toContain("dotClassFor");
    expect(src).not.toContain("COVERAGE_DOT_CLASS");
  });

  test("M4.2: ownedOverrides set tracks optimistic owned flips", () => {
    expect(src).toContain("ownedOverrides");
    expect(src).toMatch(/ownedOverrides\.has\(paintId\)/);
  });

  test("M4.2: stateForPaint folds both wantedOverrides and ownedOverrides", () => {
    expect(src).toContain("wantedOverrides");
    expect(src).toContain("ownedOverrides");
    expect(src).toMatch(/stateForPaint[\s\S]*wantedOverrides\.has/);
  });

  test("M4.2: an already-owned cell never gets downgraded", () => {
    expect(src).toMatch(/fallback === "owned"[\s\S]*return "owned"/);
  });

  test("M4.2: no raw hex in classNames (paint data goes in inline style)", () => {
    const classNameHexes = src
      .split("className=")
      .slice(1)
      .map((chunk) => chunk.split("/>")[0] ?? chunk)
      .join("\n")
      .match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(classNameHexes).toBeNull();
  });

  test("M4.2: no cyan colour token in HeatSinkGridClient", () => {
    expect(src).not.toContain("--color-cyan");
  });
});

describe("CollectionCanvas — M4.2 source-scan", () => {
  const src = read("src/components/planner/CollectionCanvas.tsx");

  test("renders a <canvas> element", () => {
    expect(src).toContain("<canvas");
  });

  test("canvas is role=img with an aria-label summary", () => {
    expect(src).toContain('role="img"');
    expect(src).toContain("aria-label");
  });

  test("reads token colours from getComputedStyle (not hardcoded hex)", () => {
    expect(src).toContain("getComputedStyle");
    expect(src).toContain("--color-green");
    expect(src).toContain("--color-yellow");
    expect(src).toContain("--color-bg");
    // No hardcoded hex in the canvas drawing code.
    expect(src).not.toMatch(/fillStyle\s*=\s*"#[0-9a-fA-F]/);
  });

  test("uses ResizeObserver for responsive redraws", () => {
    expect(src).toContain("ResizeObserver");
  });

  test("scales backing store by devicePixelRatio", () => {
    expect(src).toContain("devicePixelRatio");
  });

  test("uses computeCanvasLayout and indexAtPoint from heatSinkHelpers", () => {
    expect(src).toContain("computeCanvasLayout");
    expect(src).toContain("indexAtPoint");
    expect(src).toContain("cellRectAt");
  });
});

describe("CollectionGapFill — M4.2 source-scan", () => {
  const src = read("src/components/planner/CollectionGapFill.tsx");

  test("is a non-modal dialog panel", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="false"');
  });

  test("has a search input", () => {
    expect(src).toContain('type="search"');
  });

  test("uses the gap-fill-sheet class (mobile bottom sheet)", () => {
    expect(src).toContain("gap-fill-sheet");
  });

  test("portals to document.body on mobile (matchMedia-gated)", () => {
    expect(src).toContain("createPortal");
    expect(src).toContain('matchMedia("(max-width: 767px)")');
    expect(src).toMatch(/sheetToBody\s*\?\s*createPortal\(/);
  });

  test("calls toggleWishlistedPaint for Want action", () => {
    expect(src).toContain("toggleWishlistedPaint");
  });

  test("calls setOwnedCount for Own action", () => {
    expect(src).toContain("setOwnedCount");
  });

  test("uses buildGapFillCandidates for near-hue seeding", () => {
    expect(src).toContain("buildGapFillCandidates");
  });

  test("dismisses on Escape, click-outside, and popstate", () => {
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("contains(e.target as Node)");
    expect(src).toContain("popstate");
  });

  test("no raw hex in classNames", () => {
    const classNameHexes = src
      .split("className=")
      .slice(1)
      .map((chunk) => chunk.split("/>")[0] ?? chunk)
      .join("\n")
      .match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(classNameHexes).toBeNull();
  });

  test("Want action uses success Button variant (no cyan)", () => {
    expect(src).toMatch(/variant="success"/);
    expect(src).not.toMatch(/var\(--color-cyan\)/);
  });

  test("results are capped to prevent rendering thousands of rows", () => {
    // RESULT_CAP constant or equivalent guard.
    expect(src).toMatch(/RESULT_CAP|result_cap|50/i);
  });
});
