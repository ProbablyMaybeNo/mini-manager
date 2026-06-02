/**
 * P16.3 — HeatSinkGridCell render.
 *
 * The cell is an async server component; we render it with the `grid`
 * test seam (so it never touches the DB) and walk the returned tree to
 * pin: exactly one gridcell per coverage cell, the border class tracks
 * each cell's coverage state, the fill is the paint's stored hex, and
 * the header readout carries the summary math.
 *
 * The data layer (getCoverageGrid / composeCoverageGrid) is covered by
 * tests/integration/actions/paintCoverage.test.ts; here we only assert
 * the view.
 */
import { describe, expect, test, vi } from "vitest";

// Stub the server read layer + auth so importing the cell module in the
// node unit env doesn't pull in the DB client. The `grid` prop seam
// means these are never actually called, but the imports must resolve.
vi.mock("@/db/queries/paintCoverage", () => ({
  getCoverageGrid: vi.fn(),
}));
vi.mock("@/lib/auth-stub", () => ({
  currentUserId: vi.fn(async () => "test-user"),
}));

import { HeatSinkGridCell } from "@/components/planner/HeatSinkGridCell";
import type { CoverageGrid } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import type { Paint } from "@/lib/paints/types";

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

function collectText(node: unknown, acc: string[] = []): string[] {
  if (node == null) return acc;
  if (typeof node === "string") {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, acc);
    return acc;
  }
  const n = node as AnyNode;
  if (typeof n === "object" && n.props?.children != null) {
    collectText(n.props.children, acc);
  }
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

const grid: CoverageGrid = {
  cells: [
    cell("red", "#ff0000", "owned"),
    cell("green", "#00ff00", "wanted"),
    cell("blue", "#0000ff", "none"),
  ],
  summary: { owned: 1204, wanted: 312, total: 7144, ownedPct: 17 },
};

async function renderCell(g: CoverageGrid) {
  return (await HeatSinkGridCell({ grid: g })) as unknown;
}

function gridCells(tree: unknown): AnyNode[] {
  return findAll(tree, (n) => n.props?.role === "gridcell");
}

describe("HeatSinkGridCell render (P16.3)", () => {
  test("renders exactly one gridcell per coverage cell", async () => {
    const tree = await renderCell(grid);
    expect(gridCells(tree)).toHaveLength(3);
  });

  test("the grid container advertises its cell count", async () => {
    const tree = await renderCell(grid);
    const container = findAll(
      tree,
      (n) => typeof n.props?.["data-cell-count"] === "number",
    )[0];
    expect(container?.props["data-cell-count"]).toBe(3);
  });

  test("each cell's border class matches its coverage state", async () => {
    const tree = await renderCell(grid);
    const byState = new Map(
      gridCells(tree).map((c) => [c.props["data-state"], c.props.className]),
    );
    expect(byState.get("owned")).toContain("border-[var(--color-green)]");
    expect(byState.get("wanted")).toContain("border-[var(--color-amber)]");
    expect(byState.get("none")).toContain("border-transparent");
  });

  test("each cell is filled with its paint's stored hex", async () => {
    const tree = await renderCell(grid);
    const fills = gridCells(tree).map(
      (c) => (c.props.style as { backgroundColor?: string })?.backgroundColor,
    );
    expect(fills).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  test("header readout carries the summary math, comma-grouped", async () => {
    const tree = await renderCell(grid);
    const text = collectText(tree).join(" ");
    expect(text).toContain("1,204 / 7,144 owned · 312 wanted");
  });

  test("coverage bar reflects ownedPct", async () => {
    const tree = await renderCell(grid);
    const bar = findAll(tree, (n) => n.props?.role === "progressbar")[0];
    expect(bar?.props["aria-valuenow"]).toBe(17);
  });

  test("no gridcell border uses cyan (P13.1)", async () => {
    const tree = await renderCell(grid);
    for (const c of gridCells(tree)) {
      expect(String(c.props.className)).not.toContain("cyan");
    }
  });
});
