/**
 * GOLD-STANDARD §07 — Panel & Card semantic variants.
 *
 * Six surfaces straight off the spec image (docs/design/gold-standard-ui.png):
 *   DEFAULT  white border / white title.
 *   INFO     cyan border + ⓘ icon + cyan title.
 *   WARNING  yellow border + ⚠ icon + yellow title.
 *   SUCCESS  green border + ✓ icon + green title.
 *   ERROR    red border + ✕ icon + red title.
 *   DISABLED dim border + dim title, no icon.
 *
 * Each variant re-seeds currentColor to its hue so the existing
 * `--glow-edge` border bloom blooms in-hue, sets the matching border
 * colour, and colours its title. Pins both the CSS contract and the
 * Panel/Card component class output + icon rendering.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ReactElement } from "react";
import { Panel } from "@/components/ui/Panel";
import { Card } from "@/components/ui/Card";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

function ruleBody(selector: string): string {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  return css.match(re)?.[1] ?? "";
}

function render(el: ReactElement): { type: unknown; props: Record<string, unknown> } {
  return el as unknown as { type: unknown; props: Record<string, unknown> };
}

/** Collect every className string + element type in a rendered tree. */
function walk(node: unknown, out: { classes: string[]; types: unknown[] }) {
  if (node == null || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, out);
    return;
  }
  const n = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof n !== "object") return;
  if ("type" in n) out.types.push(n.type);
  const cls = n.props?.className;
  if (typeof cls === "string") out.classes.push(cls);
  if (n.props?.children != null) walk(n.props.children, out);
}

function collect(el: ReactElement) {
  const out = { classes: [] as string[], types: [] as unknown[] };
  walk(el, out);
  return out;
}

describe("§07 — CSS variant rules colour the border + glow in-hue", () => {
  const VARIANTS: ReadonlyArray<{ sel: string; color: string }> = [
    { sel: ".panel-info", color: "var(--color-cyan)" },
    { sel: ".panel-warning", color: "var(--color-yellow)" },
    { sel: ".panel-success", color: "var(--color-green)" },
    { sel: ".panel-error", color: "var(--color-red)" },
  ];

  for (const { sel, color } of VARIANTS) {
    test(`${sel} seeds currentColor + border-color to ${color} with an edge glow`, () => {
      const body = ruleBody(sel);
      expect(body).toMatch(
        new RegExp(`color:\\s*${color.replace(/[()]/g, "\\$&")}`),
      );
      expect(body).toMatch(
        new RegExp(`border-color:\\s*${color.replace(/[()]/g, "\\$&")}`),
      );
      expect(body).toMatch(/box-shadow:\s*var\(--glow-edge-strong\)/);
    });
  }

  test(".panel-disabled dims border + title and drops the glow", () => {
    const body = ruleBody(".panel-disabled");
    expect(body).toMatch(/color:\s*var\(--color-disabled\)/);
    expect(body).toMatch(/border-color:\s*var\(--color-disabled\)/);
    expect(body).toMatch(/box-shadow:\s*none/);
  });

  test(".panel-variant-head + .card-header-variant carry the phosphor title glow", () => {
    expect(ruleBody(".panel-variant-head")).toMatch(
      /text-shadow:\s*var\(--glow-strong\)/,
    );
    expect(css).toMatch(
      /\.card-header-variant\s\.card-header-heading\s*\{[^}]*text-shadow:\s*var\(--glow-strong\)/,
    );
  });
});

describe("§07 — <Panel> variant prop", () => {
  test("default variant emits no panel-* modifier", () => {
    const { classes } = collect(Panel({ children: "x" }) as ReactElement);
    expect(classes.join(" ")).toMatch(/\bpanel\b/);
    expect(classes.join(" ")).not.toMatch(/panel-(info|warning|success|error|disabled)/);
  });

  for (const variant of ["info", "warning", "success", "error", "disabled"] as const) {
    test(`variant="${variant}" applies .panel-${variant}`, () => {
      const { classes } = collect(
        Panel({ variant, children: "body" }) as ReactElement,
      );
      expect(classes.join(" ")).toMatch(new RegExp(`panel-${variant}`));
    });
  }

  test("info/warning/success/error render an icon; disabled + default do not", () => {
    const withIcon = ["info", "warning", "success", "error"] as const;
    for (const variant of withIcon) {
      const { types } = collect(
        Panel({ variant, title: "T", children: "b" }) as ReactElement,
      );
      // The lucide icon is a function/object component, not a host string tag.
      const hasComponent = types.some((t) => typeof t === "function" || (typeof t === "object" && t !== null));
      expect(hasComponent).toBe(true);
    }
    for (const variant of ["disabled", "default"] as const) {
      const { classes } = collect(
        Panel({ variant, title: "T", children: "b" }) as ReactElement,
      );
      expect(classes.join(" ")).not.toMatch(/panel-variant-icon/);
    }
  });

  test("title renders inside .panel-variant-head with the body wrapped", () => {
    const { classes } = collect(
      Panel({ variant: "warning", title: "Heads up", children: "details" }) as ReactElement,
    );
    expect(classes.join(" ")).toMatch(/panel-variant-head/);
    expect(classes.join(" ")).toMatch(/panel-variant-body/);
  });
});

describe("§07 — <Card> variant prop", () => {
  for (const variant of ["info", "warning", "success", "error", "disabled"] as const) {
    test(`variant="${variant}" applies .panel-${variant} on the card root`, () => {
      const root = render(Card({ variant, title: "T", children: "b" }) as ReactElement);
      expect(String(root.props.className)).toMatch(new RegExp(`panel-${variant}`));
    });
  }

  test("default variant keeps the white card (no panel-* modifier)", () => {
    const root = render(Card({ title: "T", children: "b" }) as ReactElement);
    expect(String(root.props.className)).not.toMatch(
      /panel-(info|warning|success|error|disabled)/,
    );
  });

  test("a coloured variant marks the header with .card-header-variant", () => {
    const { classes } = collect(
      Card({ variant: "success", title: "Done", children: "b" }) as ReactElement,
    );
    expect(classes.join(" ")).toMatch(/card-header-variant/);
  });
});
