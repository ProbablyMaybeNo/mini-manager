/**
 * P16.3 / P16.4 — HeatSinkGridCell server seam.
 *
 * The cell is an async server component that, since P16.4, delegates the
 * render to the `HeatSinkGridClient` client component (brand filter +
 * Condensed/Full toggle + row-chunked grid). The client uses React
 * hooks, so it can't be invoked in the Node unit env — here we render
 * the cell with the `view` test seam (so it never touches the DB) and
 * assert it mounts the client with the composed grid, brand list, and
 * default brand filter wired through unchanged.
 *
 * The cell-level render (gridcells, borders, fills, header) is covered
 * by the pure helpers in heatSinkPerf.test.ts + heatSinkHelpers.test.ts;
 * the data layer by tests/integration/actions/paintCoverage.test.ts.
 */
import { describe, expect, test, vi } from "vitest";

// Stub the server read layer + auth so importing the cell module in the
// node unit env doesn't pull in the DB client. The `view` prop seam
// means these are never actually called, but the imports must resolve.
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
