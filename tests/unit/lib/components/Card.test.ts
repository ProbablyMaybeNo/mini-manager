import { describe, expect, test } from "vitest";
import type { ReactElement } from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { Card } from "@/components/ui/Card";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

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

describe("globals.css — panel/card terminal frame primitives (Phase 0)", () => {
  test(".card fill is near-black (token), never grey", () => {
    const body = /\n\.card\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    expect(body).toMatch(/background:\s*var\(--color-bg-elevated\)/);
  });

  test(".card border is the bright-white phosphor border (gold-standard: all grey → white)", () => {
    // Gold-standard pass: the default panel/card border is bright white,
    // not the old cyan-tinted grey. The phosphor character now comes from
    // the white border + the --glow-edge box-shadow bloom, not a hue tint.
    const body = /\n\.card\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    expect(body).toMatch(/border:[^;]*var\(--color-border\)/);
    expect(body).toMatch(/box-shadow:[\s\S]*var\(--glow-edge\)/);
  });

  test(".panel primitive exists with near-black/transparent fill", () => {
    expect(css).toMatch(/\.panel\s*\{/);
    expect(css).toMatch(/\.panel-transparent\s*\{\s*background:\s*transparent/);
  });

  test(".panel-nested draws an inset inner ring", () => {
    const body = /\.panel-nested\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    expect(body).toMatch(/box-shadow:\s*[\s\S]*inset/);
  });

  test(".panel-ticks draws corner brackets via ::before/::after", () => {
    expect(css).toMatch(/\.panel-ticks::before/);
    expect(css).toMatch(/\.panel-ticks::after/);
  });

  test(".panel-label is the technical caption slot (cyan, mono)", () => {
    const body = /\.panel-label\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    expect(body).toMatch(/color:\s*var\(--color-cyan\)/);
    expect(body).toMatch(/font-family:\s*var\(--font-mono\)/);
  });
});

describe("Card terminal treatment — nested border / ticks / tech label (Phase 0)", () => {
  function rootClass(tree: ReactElement): string {
    const n = tree as unknown as { props: Record<string, unknown> };
    return String(n.props.className ?? "");
  }

  test("plain card carries the base .card class only", () => {
    const tree = render({ children: "body" });
    const cls = rootClass(tree);
    expect(cls).toMatch(/\bcard\b/);
    expect(cls).not.toMatch(/card-nested/);
    expect(cls).not.toMatch(/panel-ticks/);
  });

  test("nested adds .card-nested for the inner bezel ring", () => {
    const tree = render({ nested: true, children: "body" });
    expect(rootClass(tree)).toMatch(/\bcard-nested\b/);
  });

  test("ticks adds .panel-ticks for corner brackets", () => {
    const tree = render({ ticks: true, children: "body" });
    expect(rootClass(tree)).toMatch(/\bpanel-ticks\b/);
  });

  test("techLabel renders an aria-hidden .panel-label caption", () => {
    const tree = render({ techLabel: "SYS · OK", children: "body" });
    const label = findFirst(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes(
        "panel-label",
      ),
    );
    expect(label).not.toBeNull();
    expect(label?.props.children).toBe("SYS · OK");
    expect(label?.props["aria-hidden"]).toBe(true);
  });

  test("no techLabel renders no panel-label element", () => {
    const tree = render({ children: "body" });
    const label = findFirst(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes(
        "panel-label",
      ),
    );
    expect(label).toBeNull();
  });
});

describe("Card accent palette — 5-color slot coverage (P11.10)", () => {
  test("purple accent dot renders the pastel-purple background", () => {
    const tree = render({
      title: "Special",
      accentColor: "purple",
      children: "body",
    });
    const dot = findFirst(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes(
        "card-header-accent",
      ),
    );
    expect(dot).not.toBeNull();
    expect(String(dot?.props.className ?? "")).toContain("--color-purple-pastel");
  });

  test("yellow accent dot renders the pastel-yellow background", () => {
    const tree = render({
      title: "Wishlist",
      accentColor: "yellow",
      children: "body",
    });
    const dot = findFirst(tree, (n) =>
      String((n.props.className as string | undefined) ?? "").includes(
        "card-header-accent",
      ),
    );
    expect(dot).not.toBeNull();
    expect(String(dot?.props.className ?? "")).toContain("--color-yellow");
  });

  test("cyan / green / amber / red accents remain wired", () => {
    for (const accent of ["cyan", "green", "amber", "red"] as const) {
      const tree = render({
        title: "X",
        accentColor: accent,
        children: "body",
      });
      const dot = findFirst(tree, (n) =>
        String((n.props.className as string | undefined) ?? "").includes(
          "card-header-accent",
        ),
      );
      expect(dot).not.toBeNull();
      expect(String(dot?.props.className ?? "")).toContain(`--color-${accent}`);
    }
  });
});
