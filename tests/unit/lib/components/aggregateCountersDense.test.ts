/**
 * P13.5 — AggregateCountersDisplay collapses to a single dense row.
 *
 * Ross flagged the aggregated stage panel as too tall on the project
 * detail page: six stacked rows of stage+bar+number was the visual
 * cost of mirroring the full StageCounter shape on a read-only mirror.
 * The replacement is one grid row with six stage cells (OWNED · BUILD
 * · PRIME · PAINT · BASE · DONE), each showing value/total + a slim
 * stage-tinted progress fill.
 *
 * These tests pin the new shape so a future refactor can't quietly
 * regress to the stacked layout.
 */
import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import { AggregateCountersDisplay } from "@/components/AggregateCountersDisplay";
import type { AggregateCounters } from "@/lib/progress";

type AnyNode = { type: unknown; props: Record<string, unknown> };

function findAll(
  node: unknown,
  predicate: (n: AnyNode) => boolean,
): AnyNode[] {
  const out: AnyNode[] = [];
  if (node == null || typeof node === "string") return out;
  if (Array.isArray(node)) {
    for (const child of node) out.push(...findAll(child, predicate));
    return out;
  }
  const n = node as AnyNode;
  if (typeof n !== "object" || !("type" in n) || !("props" in n)) return out;
  if (predicate(n)) out.push(n);
  const children = n.props?.children;
  if (children != null) out.push(...findAll(children, predicate));
  return out;
}

function makeAggregate(over: Partial<AggregateCounters> = {}): AggregateCounters {
  return {
    count: 10,
    ownedCount: 0,
    buildCount: 0,
    primeCount: 0,
    paintCount: 0,
    baseCount: 0,
    completeCount: 0,
    ...over,
  };
}

function render(
  agg: AggregateCounters,
  childCount = 3,
): ReactElement {
  return AggregateCountersDisplay({ aggregate: agg, childCount }) as unknown as ReactElement;
}

function classOf(n: AnyNode): string {
  return String(n.props.className ?? "");
}

describe("AggregateCountersDisplay — dense single-row layout (P13.5)", () => {
  test("renders exactly six stage cells, no longer one row per stage", () => {
    const tree = render(makeAggregate({ ownedCount: 5, buildCount: 3 }));
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    expect(cells).toHaveLength(6);
  });

  test("each cell exposes a label · value · progressbar trio", () => {
    const tree = render(
      makeAggregate({
        ownedCount: 8,
        buildCount: 6,
        primeCount: 4,
        paintCount: 2,
        baseCount: 1,
        completeCount: 0,
      }),
    );

    // Every cell carries a progressbar with aria-valuenow set.
    const bars = findAll(tree, (n) => n.props.role === "progressbar");
    expect(bars).toHaveLength(6);
    for (const bar of bars) {
      expect(bar.props["aria-valuemin"]).toBe(0);
      expect(bar.props["aria-valuemax"]).toBe(100);
      expect(typeof bar.props["aria-valuenow"]).toBe("number");
    }
  });

  test("cells display the OWNED / BUILD / PRIME / PAINT / BASE / DONE labels in order", () => {
    const tree = render(makeAggregate({ ownedCount: 1 }));
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    const labels = cells.map((cell) => {
      const labelSpan = findAll(cell, (n) =>
        classOf(n).includes("uppercase tracking-wider"),
      )[0];
      return String(labelSpan?.props.children ?? "");
    });
    expect(labels).toEqual([
      "OWNED",
      "BUILD",
      "PRIME",
      "PAINT",
      "BASE",
      "DONE",
    ]);
  });

  test("uses a 6-column grid on sm+ screens (not 6 stacked rows)", () => {
    const tree = render(makeAggregate({ ownedCount: 1 }));
    const grid = findAll(tree, (n) => n.props.role === "list")[0];
    expect(grid).toBeDefined();
    expect(classOf(grid!)).toMatch(/grid-cols-/);
    expect(classOf(grid!)).toContain("sm:grid-cols-6");
  });

  test("renders empty-state when no models are registered", () => {
    const tree = render(makeAggregate({ count: 0 }));
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    expect(cells).toHaveLength(0);
    const root = tree as unknown as AnyNode;
    const text = JSON.stringify(root.props.children);
    expect(text).toMatch(/No models registered/);
  });

  test("source caption mentions sub-project count", () => {
    const tree = render(makeAggregate({ ownedCount: 1 }), 4);
    const text = JSON.stringify((tree as unknown as AnyNode).props.children);
    expect(text).toMatch(/aggregated from 4 sub-projects/);
  });
});

describe("AggregateCountersDisplay — stage tint per cell (P13.5)", () => {
  function tintAt(idx: number, agg: AggregateCounters): string | undefined {
    const tree = render(agg);
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    const cell = cells[idx];
    if (!cell) return undefined;
    // The fill <span> sits inside the cell's progressbar and uses
    // an inline backgroundColor. Read it back.
    const bar = findAll(cell, (n) => n.props.role === "progressbar")[0];
    const fill = findAll(bar, (n) => {
      const style = n.props.style as Record<string, unknown> | undefined;
      return !!(style && "backgroundColor" in style);
    })[0];
    const style = fill?.props.style as Record<string, string> | undefined;
    return style?.backgroundColor;
  }

  test("OWNED cell tints amber", () => {
    expect(tintAt(0, makeAggregate({ ownedCount: 1 }))).toContain("amber");
  });

  test("BUILD + PRIME cells tint cyan", () => {
    expect(tintAt(1, makeAggregate({ ownedCount: 1, buildCount: 1 }))).toContain(
      "cyan",
    );
    expect(
      tintAt(2, makeAggregate({ ownedCount: 1, buildCount: 1, primeCount: 1 })),
    ).toContain("cyan");
  });

  test("PAINT + BASE cells tint yellow", () => {
    const agg = makeAggregate({
      ownedCount: 5,
      buildCount: 5,
      primeCount: 5,
      paintCount: 3,
      baseCount: 2,
    });
    expect(tintAt(3, agg)).toContain("yellow");
    expect(tintAt(4, agg)).toContain("yellow");
  });

  test("DONE cell tints green", () => {
    const agg = makeAggregate({
      ownedCount: 5,
      buildCount: 5,
      primeCount: 5,
      paintCount: 5,
      baseCount: 5,
      completeCount: 5,
    });
    expect(tintAt(5, agg)).toContain("green");
  });
});

describe("AggregateCountersDisplay — progressbar width tracks value/total (P13.5)", () => {
  test("zero progress renders 0% fill", () => {
    const tree = render(makeAggregate({ ownedCount: 0 }));
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    const ownedBar = findAll(cells[0]!, (n) => n.props.role === "progressbar")[0];
    expect(ownedBar?.props["aria-valuenow"]).toBe(0);
  });

  test("half progress renders ~50% fill", () => {
    const tree = render(makeAggregate({ count: 10, ownedCount: 5 }));
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    const ownedBar = findAll(cells[0]!, (n) => n.props.role === "progressbar")[0];
    expect(ownedBar?.props["aria-valuenow"]).toBe(50);
  });

  test("full progress renders 100% fill", () => {
    const tree = render(
      makeAggregate({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
        completeCount: 10,
      }),
    );
    const cells = findAll(tree, (n) => n.props.role === "listitem");
    const doneBar = findAll(cells[5]!, (n) => n.props.role === "progressbar")[0];
    expect(doneBar?.props["aria-valuenow"]).toBe(100);
  });
});
