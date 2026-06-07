/**
 * GOLD-STANDARD §06 — MeterBar labeled usage meter.
 *
 * Label left, level-coloured percentage right, thin smooth bar below
 * (coloured fill on a dark track). The image colours by usage LEVEL:
 * low → cyan, mid → yellow, high → red (CPU 42% cyan · MEM 76% yellow ·
 * STORAGE 91% red). Pins the level→colour map, clamping, a11y, and the
 * §06 CSS layout contract.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ReactElement } from "react";
import { MeterBar } from "@/components/ui/MeterBar";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

type Props = Parameters<typeof MeterBar>[0];

function render(props: Props): { type: unknown; props: Record<string, unknown> } {
  return MeterBar(props) as unknown as {
    type: unknown;
    props: Record<string, unknown>;
  };
}

/** Find the first descendant whose inline style has a `background`. */
function findFill(node: unknown): Record<string, unknown> | null {
  if (node == null || typeof node === "string") return null;
  if (Array.isArray(node)) {
    for (const c of node) {
      const hit = findFill(c);
      if (hit) return hit;
    }
    return null;
  }
  const n = node as { props?: Record<string, unknown> };
  if (typeof n !== "object") return null;
  const style = n.props?.style as Record<string, unknown> | undefined;
  if (style && "background" in style && "width" in style) return style;
  if (n.props?.children != null) return findFill(n.props.children);
  return null;
}

/** Collect text from the readout span (the element with a coloured style). */
function findReadoutColor(node: unknown): string | null {
  if (node == null || typeof node === "string") return null;
  if (Array.isArray(node)) {
    for (const c of node) {
      const hit = findReadoutColor(c);
      if (hit) return hit;
    }
    return null;
  }
  const n = node as { props?: Record<string, unknown> };
  if (typeof n !== "object") return null;
  const style = n.props?.style as Record<string, unknown> | undefined;
  if (style && "color" in style && !("width" in style)) {
    return String(style.color);
  }
  if (n.props?.children != null) return findReadoutColor(n.props.children);
  return null;
}

describe("§06 — level → colour map (auto tone)", () => {
  const cases: ReadonlyArray<{ pct: number; token: string; level: string }> = [
    { pct: 42, token: "var(--status-info)", level: "low → cyan" },
    { pct: 59, token: "var(--status-info)", level: "just under mid → cyan" },
    { pct: 60, token: "var(--status-warning)", level: "mid → yellow" },
    { pct: 76, token: "var(--status-warning)", level: "mid → yellow" },
    { pct: 84, token: "var(--status-warning)", level: "high-mid → yellow" },
    { pct: 85, token: "var(--status-danger)", level: "high → red" },
    { pct: 91, token: "var(--status-danger)", level: "high → red" },
  ];

  for (const { pct, token, level } of cases) {
    test(`${pct}% (${level})`, () => {
      const el = render({ label: "CPU", percent: pct });
      const fill = findFill(el);
      expect(fill?.background).toBe(token);
      expect(fill?.width).toBe(`${pct}%`);
      expect(findReadoutColor(el)).toBe(token);
    });
  }
});

describe("§06 — clamping + readout", () => {
  test("clamps below 0 and above 100", () => {
    expect(findFill(render({ label: "X", percent: -10 }))?.width).toBe("0%");
    expect(findFill(render({ label: "X", percent: 150 }))?.width).toBe("100%");
  });

  test("default readout is rounded NN%", () => {
    const el = render({ label: "MEMORY", percent: 76.4 });
    expect(JSON.stringify(el)).toContain("76%");
  });

  test("explicit tone locks the colour regardless of percent", () => {
    const el = render({ label: "X", percent: 95, tone: "ok" });
    expect(findFill(el)?.background).toBe("var(--status-ok)");
  });
});

describe("§06 — a11y", () => {
  test("exposes role=progressbar with clamped aria-valuenow", () => {
    const el = render({ label: "STORAGE", percent: 91 });
    expect(el.props.role).toBe("progressbar");
    expect(el.props["aria-valuenow"]).toBe(91);
    expect(el.props["aria-valuemin"]).toBe(0);
    expect(el.props["aria-valuemax"]).toBe(100);
    expect(String(el.props["aria-label"])).toMatch(/STORAGE.*91 percent/);
  });
});

describe("§06 — CSS layout matches the image", () => {
  function ruleBody(selector: string): string {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
    );
    return css.match(re)?.[1] ?? "";
  }

  test(".meter-head puts label left, readout right (space-between)", () => {
    expect(ruleBody(".meter-head")).toMatch(/justify-content:\s*space-between/);
  });

  test(".meter-track is a dark, bordered, thin track", () => {
    const body = ruleBody(".meter-track");
    expect(body).toMatch(/background:\s*var\(--color-bg-panel\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--color-border\)/);
    expect(body).toMatch(/overflow:\s*hidden/);
  });

  test(".meter-label is white; .meter-readout is bold tabular", () => {
    expect(ruleBody(".meter-label")).toMatch(/color:\s*var\(--color-fg\)/);
    expect(ruleBody(".meter-readout")).toMatch(/tabular-nums/);
  });
});
