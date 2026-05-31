/**
 * P11.5 — StageBarsStrip primitive contract.
 *
 * 5 small stage-tinted squares replacing the `─ ─ ─ ─ ─` text-dash
 * placeholder on the project list row. Validates structure (5 spans),
 * accessibility (role + aria-label), and the stage→colour mapping.
 */
import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import { StageBarsStrip } from "@/components/ui/StageBarsStrip";

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

function render(props: Parameters<typeof StageBarsStrip>[0]): ReactElement {
  return StageBarsStrip(props) as unknown as ReactElement;
}

describe("StageBarsStrip — structure (P11.5)", () => {
  test("renders 5 squares — one per stage", () => {
    const tree = render({
      counts: {
        buildCount: 0,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 0,
      },
    });
    const squares = findAll(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes("w-3 h-3"),
    );
    expect(squares).toHaveLength(5);
  });

  test("wrapper exposes role=img with descriptive aria-label", () => {
    const tree = render({
      counts: {
        buildCount: 1,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 5,
      },
    });
    const root = tree as unknown as AnyNode;
    expect(root.props.role).toBe("img");
    expect(String(root.props["aria-label"] ?? "")).toMatch(/stage progress/i);
  });
});

describe("StageBarsStrip — stage → palette tone mapping (P11.5)", () => {
  function classOf(n: AnyNode): string {
    return String(n.props.className ?? "");
  }

  test("build + prime tint cyan", () => {
    const tree = render({
      counts: {
        buildCount: 1,
        primeCount: 1,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 5,
      },
    });
    const squares = findAll(tree, (n) => classOf(n).includes("w-3 h-3"));
    expect(classOf(squares[0]!)).toContain("--color-cyan");
    expect(classOf(squares[1]!)).toContain("--color-cyan");
  });

  test("paint + base tint pastel yellow", () => {
    const tree = render({
      counts: {
        buildCount: 0,
        primeCount: 0,
        paintCount: 1,
        baseCount: 1,
        completeCount: 0,
        total: 5,
      },
    });
    const squares = findAll(tree, (n) => classOf(n).includes("w-3 h-3"));
    expect(classOf(squares[2]!)).toContain("--color-yellow");
    expect(classOf(squares[3]!)).toContain("--color-yellow");
  });

  test("complete (DONE) tints neon green", () => {
    const tree = render({
      counts: {
        buildCount: 0,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 1,
        total: 5,
      },
    });
    const squares = findAll(tree, (n) => classOf(n).includes("w-3 h-3"));
    expect(classOf(squares[4]!)).toContain("--color-green");
  });
});

describe("StageBarsStrip — opacity scales with count proportion (P11.5)", () => {
  function opacityAt(idx: number, props: Parameters<typeof StageBarsStrip>[0]) {
    const tree = render(props);
    const squares = findAll(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes("w-3 h-3"),
    );
    const style = squares[idx]!.props.style as Record<string, unknown>;
    return Number(style.opacity);
  }

  test("empty stage renders at ghost-opacity (~0.18) so structure stays visible", () => {
    const op = opacityAt(0, {
      counts: {
        buildCount: 0,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 0,
      },
    });
    expect(op).toBeLessThan(0.25);
  });

  test("fully-filled stage renders at full opacity", () => {
    const op = opacityAt(0, {
      counts: {
        buildCount: 10,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 10,
      },
    });
    expect(op).toBe(1);
  });

  test("half-filled stage renders at the mid-bucket opacity", () => {
    const op = opacityAt(0, {
      counts: {
        buildCount: 5,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        total: 10,
      },
    });
    expect(op).toBeGreaterThan(0.5);
    expect(op).toBeLessThan(0.85);
  });
});
