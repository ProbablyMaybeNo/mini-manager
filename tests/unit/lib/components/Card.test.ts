import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";

type AnyNode = { type: unknown; props: Record<string, unknown> } | string | null;

function asNode(value: unknown): AnyNode {
  if (value == null || typeof value === "string") return value as AnyNode;
  return value as { type: unknown; props: Record<string, unknown> };
}

function findFirst(
  node: unknown,
  predicate: (n: { type: unknown; props: Record<string, unknown> }) => boolean,
): { type: unknown; props: Record<string, unknown> } | null {
  if (node == null || typeof node === "string") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findFirst(child, predicate);
      if (hit) return hit;
    }
    return null;
  }
  const n = node as { type: unknown; props: Record<string, unknown> };
  if (typeof n !== "object" || !("type" in n) || !("props" in n)) return null;
  if (predicate(n)) return n;
  const children = n.props?.children;
  if (children != null) return findFirst(children, predicate);
  return null;
}

function render(props: Parameters<typeof Card>[0]): ReactElement {
  return Card(props) as unknown as ReactElement;
}

describe("Card primitive — heading semantics (UX-V3-005)", () => {
  test("title renders as a real <h2> by default", () => {
    const tree = render({ title: "Sign in", children: "body" });
    const heading = findFirst(tree, (n) => n.type === "h2");
    expect(heading).not.toBeNull();
    expect(heading?.props.children).toBe("Sign in");
  });

  test("titleAs='h3' renders the title as an <h3>", () => {
    const tree = render({
      title: "Nested section",
      titleAs: "h3",
      children: "body",
    });
    const h3 = findFirst(tree, (n) => n.type === "h3");
    expect(h3).not.toBeNull();
    expect(h3?.props.children).toBe("Nested section");
    const h2 = findFirst(tree, (n) => n.type === "h2");
    expect(h2).toBeNull();
  });

  test("title element carries the card-header-heading class for chrome treatment", () => {
    const tree = render({ title: "Sign in", children: "body" });
    const heading = findFirst(tree, (n) => n.type === "h2");
    expect(heading).not.toBeNull();
    const cls = String(heading?.props.className ?? "");
    expect(cls).toMatch(/card-header-heading/);
  });

  test("no title renders no heading at all", () => {
    const tree = render({ children: "body" });
    const h2 = findFirst(tree, (n) => n.type === "h2");
    const h3 = findFirst(tree, (n) => n.type === "h3");
    expect(h2).toBeNull();
    expect(h3).toBeNull();
  });

  test("section element still receives aria-label from title", () => {
    const tree = asNode(render({ title: "Sign in", children: "body" }));
    expect(tree && typeof tree === "object" ? tree.props["aria-label"] : null).toBe(
      "Sign in",
    );
  });
});
