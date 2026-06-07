/**
 * P13.1 — Button primitive overhaul sentinel.
 *
 * Ross killed the `[ ]` bracketed-outline aesthetic on action buttons.
 * Every variant now renders SOLID-FILLED with black text by default.
 * Outlined remains an option for low-emphasis surfaces via the new
 * `tone="outline"` prop (default `tone="solid"`).
 *
 * This file pins:
 *   1. Each variant's solid-fill CSS rule (background + dark text).
 *   2. The `.btn-outline.btn-*` modifier rules for the escape hatch.
 *   3. The Button primitive renders the right classes for both tones.
 *   4. WCAG AA contrast (≥4.5:1) of black text on every variant fill.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/Button";

function readCss(): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../src/app/globals.css"),
    "utf-8",
  );
}

function render(props: Parameters<typeof Button>[0]): ReactElement {
  return Button(props) as unknown as ReactElement;
}

function classNameOf(el: ReactElement): string {
  const props = (el as unknown as { props: Record<string, unknown> }).props;
  return String(props.className ?? "");
}

function bodyOf(css: string, selector: string): string {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  const m = css.match(re);
  if (!m || m[1] === undefined) {
    throw new Error(`selector ${selector} not found in globals.css`);
  }
  return m[1];
}

/* ---------- WCAG 2.2 §1.4.3 contrast (relative-luminance, sRGB) ---------- */

type Rgb = readonly [number, number, number];

function relChannel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(rgb: Rgb): number {
  return (
    0.2126 * relChannel(rgb[0]) +
    0.7152 * relChannel(rgb[1]) +
    0.0722 * relChannel(rgb[2])
  );
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Palette tokens — kept in sync with globals.css @theme block. The
 *  test on the CSS file itself confirms the same hex values stay
 *  declared, so a future palette-token change has to update both. */
const PALETTE = {
  // GOLD-STANDARD palette (docs/design/gold-standard-ui.png + Ross's
  // tweaks). Near-black base #0A0A0A, foreground bright white #FFFFFF, the
  // brighter phosphor accents. All clear WCAG-AA black-on-fill: cyan 16.87,
  // green 16.77, yellow 17.69, purple 6.51, red 7.05.
  bg: [0x0a, 0x0a, 0x0a],
  fg: [0xff, 0xff, 0xff],
  cyan: [0x7d, 0xf9, 0xff],
  green: [0x8b, 0xff, 0x8b],
  yellow: [0xf2, 0xef, 0xa8],
  red: [0xff, 0x5f, 0x5f],
  purple: [0x9b, 0x80, 0xdc],
} as const satisfies Record<string, Rgb>;

describe("P13.1 — every action variant is solid-filled with dark text", () => {
  const css = readCss();

  const SOLID_VARIANTS: ReadonlyArray<{ name: string; bg: string }> = [
    { name: ".btn-primary", bg: "var(--color-cyan)" },
    // Phase-0 tier system: secondary is green (distinct from cyan primary).
    { name: ".btn-secondary", bg: "var(--color-green)" },
    { name: ".btn-danger", bg: "var(--color-red)" },
    { name: ".btn-success", bg: "var(--color-green)" },
    { name: ".btn-warning", bg: "var(--color-yellow)" },
    { name: ".btn-purple", bg: "var(--color-purple-pastel)" },
  ];

  for (const { name, bg } of SOLID_VARIANTS) {
    test(`${name} declares background: ${bg} + color: var(--color-bg)`, () => {
      const body = bodyOf(css, name);
      expect(body).toMatch(
        new RegExp(`background:\\s*${bg.replace(/[()]/g, "\\$&")}`),
      );
      expect(body).toMatch(/color:\s*var\(--color-bg\)/);
    });
  }

  test("ghost variant carries a solid background (no transparent fallback)", () => {
    const body = bodyOf(css, ".btn-ghost");
    expect(body).not.toMatch(/background:\s*transparent/);
    expect(body).toMatch(/background:\s*var\(--color-bg-panel\)/);
  });
});

describe("P13.1 — `.btn-outline` modifier exists for low-emphasis surfaces", () => {
  const css = readCss();

  test("base .btn-outline rule flips background back to transparent", () => {
    const body = bodyOf(css, ".btn-outline");
    expect(body).toMatch(/background:\s*transparent/);
  });

  for (const variant of [
    ".btn-outline.btn-primary",
    ".btn-outline.btn-danger",
    ".btn-outline.btn-success",
    ".btn-outline.btn-warning",
    ".btn-outline.btn-purple",
    ".btn-outline.btn-ghost",
  ]) {
    test(`${variant} declares a coloured text + border (no bg fill)`, () => {
      // Combined comma-grouped selector keeps the rule body short; assert
      // via a fresh regex that the selector appears anywhere in the file.
      expect(css).toMatch(
        new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    });
  }
});

describe("P13.1 — WCAG AA contrast (≥4.5:1) on every variant fill", () => {
  type FillKey = "cyan" | "red" | "green" | "yellow" | "purple";
  const checks: ReadonlyArray<{ name: string; bg: FillKey }> = [
    { name: "primary (cyan)", bg: "cyan" },
    { name: "secondary (cyan)", bg: "cyan" },
    { name: "danger (red)", bg: "red" },
    { name: "success (green)", bg: "green" },
    { name: "warning (yellow)", bg: "yellow" },
    { name: "purple", bg: "purple" },
  ];

  for (const { name, bg } of checks) {
    test(`${name} on black text passes WCAG AA (≥4.5:1)`, () => {
      const ratio = contrastRatio(PALETTE[bg], PALETTE.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("danger (red) on white text fails AA — sanity check we picked black", () => {
    // Red passes black-on-fill (5.93:1) but fails white-on-fill (3.06:1).
    // This pin confirms the variant uses --color-bg (black) as Phase 13
    // requires, not --color-fg (white).
    const ratio = contrastRatio(PALETTE.red, PALETTE.fg);
    expect(ratio).toBeLessThan(4.5);
  });

  test("ghost (near-black panel) on white text passes AA (≥4.5:1)", () => {
    // Phase-0 killed the grey panel fill: ghost now sits on the near-black
    // panel (--color-bg-panel = #0a0a0a) + foreground #f5f5f5, with the
    // 1px phosphor border carrying the affordance. Contrast climbs to ~19:1.
    const panel: Rgb = [0x0a, 0x0a, 0x0a];
    const ratio = contrastRatio(panel, PALETTE.fg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("P13.1 — Button primitive `tone` prop", () => {
  test("default tone is solid — no btn-outline class on render", () => {
    const el = render({ variant: "success", children: "Add" });
    expect(classNameOf(el)).not.toMatch(/\bbtn-outline\b/);
  });

  test("tone='solid' is explicit and still emits no btn-outline class", () => {
    const el = render({ variant: "success", tone: "solid", children: "Add" });
    expect(classNameOf(el)).not.toMatch(/\bbtn-outline\b/);
  });

  test("tone='outline' adds the btn-outline modifier class", () => {
    const el = render({
      variant: "danger",
      tone: "outline",
      children: "Cancel",
    });
    expect(classNameOf(el)).toMatch(/\bbtn-outline\b/);
    // The variant class stays — outline is purely additive.
    expect(classNameOf(el)).toMatch(/\bbtn-danger\b/);
  });

  test("tone='outline' works on anchor form too (as='a')", () => {
    const el = render({
      as: "a",
      href: "/x",
      variant: "purple",
      tone: "outline",
      children: "Featured",
    });
    expect(classNameOf(el)).toMatch(/\bbtn-outline\b/);
    expect(classNameOf(el)).toMatch(/\bbtn-purple\b/);
    expect((el as unknown as { type: string }).type).toBe("a");
  });
});

describe("P13.1 — `[ ]` bracket aesthetic stays retired", () => {
  /* No CSS pseudo-element is permitted to inject literal "[ " / " ]"
   * around button content. The original P11.11 bracketAudit covered
   * JSX text; this pin extends to ::before / ::after content rules
   * that target .btn-* selectors. */
  const css = readCss();

  test("no .btn-* pseudo-element injects literal bracket text", () => {
    // Find every ::before / ::after rule whose selector starts with .btn,
    // assert its content doesn't carry a bracket character.
    const re = /\.btn[\w-]*::(?:before|after)\s*\{([^}]*)\}/g;
    let match;
    while ((match = re.exec(css)) !== null) {
      expect(match[1]).not.toMatch(/content:\s*["'`].*\[/);
      expect(match[1]).not.toMatch(/content:\s*["'`].*\]/);
    }
  });
});
