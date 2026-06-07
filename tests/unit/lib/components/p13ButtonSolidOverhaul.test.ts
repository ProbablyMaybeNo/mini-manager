/**
 * Button primitive contract — GOLD-STANDARD outline overhaul.
 *
 * SUPERSEDES the P13.1 "every variant solid-filled" rule. Ross reversed
 * it and confirmed the spec image (docs/design/gold-standard-ui.png §03)
 * as the literal contract:
 *
 *   PRIMARY    solid cyan fill + black text  — the lone solid lead action.
 *   SECONDARY  white border + white text, no fill.
 *   SUCCESS    green border + green text, no fill.
 *   WARNING    pastel-yellow border + yellow text, no fill.
 *   DANGER     red border + red text, no fill.
 *   PURPLE     pastel-purple border + text, no fill.
 *   GHOST      near-black fill + neutral border + white text (tertiary).
 *
 * `tone="solid"` (→ `.btn-solid`) is the escape hatch that refills a
 * coloured variant with its hue + black text for hard-commit surfaces.
 *
 * This file pins:
 *   1. PRIMARY's solid-fill CSS rule (cyan bg + black text).
 *   2. Each coloured variant's OUTLINE rule (coloured text + border, no
 *      own bg fill).
 *   3. The `.btn-solid.btn-*` escape-hatch refill rules.
 *   4. The Button primitive renders the right classes for each tone.
 *   5. WCAG AA contrast (≥4.5:1) of every variant in its default rendering
 *      (black-on-cyan for primary; coloured-text-on-#0a0a0a for outlines).
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

/** Palette tokens — kept in sync with globals.css @theme block. */
const PALETTE = {
  bg: [0x0a, 0x0a, 0x0a],
  fg: [0xff, 0xff, 0xff],
  cyan: [0x7d, 0xf9, 0xff],
  green: [0x8b, 0xff, 0x8b],
  yellow: [0xf2, 0xef, 0xa8],
  red: [0xff, 0x5f, 0x5f],
  purple: [0x9b, 0x80, 0xdc],
} as const satisfies Record<string, Rgb>;

describe("GOLD-STANDARD §03 — PRIMARY is the lone solid-filled variant", () => {
  const css = readCss();

  test(".btn-primary declares background: var(--color-cyan) + color: var(--color-bg)", () => {
    const body = bodyOf(css, ".btn-primary");
    expect(body).toMatch(/background:\s*var\(--color-cyan\)/);
    expect(body).toMatch(/color:\s*var\(--color-bg\)/);
  });

  test("ghost variant carries a solid near-black panel fill (tertiary)", () => {
    const body = bodyOf(css, ".btn-ghost");
    expect(body).not.toMatch(/background:\s*transparent/);
    expect(body).toMatch(/background:\s*var\(--color-bg-panel\)/);
  });
});

describe("GOLD-STANDARD §03 — coloured intent variants ship as OUTLINE", () => {
  const css = readCss();

  const OUTLINE_VARIANTS: ReadonlyArray<{ name: string; fg: string }> = [
    { name: ".btn-secondary", fg: "var(--color-fg)" },
    { name: ".btn-danger", fg: "var(--color-red)" },
    { name: ".btn-success", fg: "var(--color-green)" },
    { name: ".btn-warning", fg: "var(--color-yellow)" },
    { name: ".btn-purple", fg: "var(--color-purple-pastel)" },
  ];

  // Shared rule (the comma-grouped selector) gives every coloured variant
  // a transparent ground — assert the grouped selector sets transparent bg.
  test("the coloured variants share a transparent-background rule", () => {
    expect(css).toMatch(
      /\.btn-secondary,[\s\S]{0,120}?background:\s*transparent/,
    );
  });

  /** Find the STANDALONE variant rule (the single-selector `{ ... }` block),
   *  skipping the comma-grouped shared rule that also ends in the selector
   *  (e.g. the `.btn-secondary, … , .btn-purple { background: transparent }`
   *  group). We scan every `selector { body }` and keep the one whose body
   *  carries a `color:` declaration. */
  function standaloneBody(name: string): string {
    const sel = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[,}\\s])${sel}\\s*\\{([^}]*)\\}`, "g");
    let m;
    const bodies: string[] = [];
    while ((m = re.exec(css)) !== null) {
      if (m[2]) bodies.push(m[2]);
    }
    const own = bodies.find((b) => /(^|;|\s)color:/.test(b));
    if (own === undefined) {
      throw new Error(`standalone rule for ${name} not found`);
    }
    return own;
  }

  for (const { name, fg } of OUTLINE_VARIANTS) {
    test(`${name} declares coloured text + border (no own bg fill)`, () => {
      const body = standaloneBody(name);
      expect(body).toMatch(
        new RegExp(`color:\\s*${fg.replace(/[()]/g, "\\$&")}`),
      );
      expect(body).toMatch(
        new RegExp(`border-color:\\s*${fg.replace(/[()]/g, "\\$&")}`),
      );
      // The variant's OWN rule must not set a coloured solid background.
      expect(body).not.toMatch(/background:\s*var\(/);
    });
  }
});

describe("GOLD-STANDARD §03 — `.btn-solid` escape hatch refills coloured variants", () => {
  const css = readCss();

  for (const variant of [
    ".btn-solid.btn-secondary",
    ".btn-solid.btn-danger",
    ".btn-solid.btn-success",
    ".btn-solid.btn-warning",
    ".btn-solid.btn-purple",
  ]) {
    test(`${variant} refills with a coloured background + black text`, () => {
      const body = bodyOf(css, variant);
      expect(body).toMatch(/background:\s*var\(--color-/);
      expect(body).toMatch(/color:\s*var\(--color-bg\)/);
    });
  }
});

describe("GOLD-STANDARD §03 — WCAG AA contrast (≥4.5:1) in default rendering", () => {
  // PRIMARY: black text on cyan fill.
  test("primary (black text on cyan fill) passes AA", () => {
    expect(contrastRatio(PALETTE.cyan, PALETTE.bg)).toBeGreaterThanOrEqual(4.5);
  });

  // OUTLINE variants: coloured text on the near-black ground (#0a0a0a).
  type FgKey = "fg" | "red" | "green" | "yellow" | "purple";
  const outlines: ReadonlyArray<{ name: string; fg: FgKey }> = [
    { name: "secondary (white text)", fg: "fg" },
    { name: "danger (red text)", fg: "red" },
    { name: "success (green text)", fg: "green" },
    { name: "warning (yellow text)", fg: "yellow" },
    { name: "purple text", fg: "purple" },
  ];

  for (const { name, fg } of outlines) {
    test(`${name} on #0a0a0a passes AA (≥4.5:1)`, () => {
      expect(contrastRatio(PALETTE[fg], PALETTE.bg)).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }

  test("ghost (near-black panel) on white text passes AA (≥4.5:1)", () => {
    const panel: Rgb = [0x0a, 0x0a, 0x0a];
    expect(contrastRatio(panel, PALETTE.fg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("GOLD-STANDARD §03 — Button primitive `tone` prop", () => {
  test("default tone is outline — emits btn-outline, not btn-solid", () => {
    const el = render({ variant: "success", children: "Add" });
    expect(classNameOf(el)).toMatch(/\bbtn-outline\b/);
    expect(classNameOf(el)).not.toMatch(/\bbtn-solid\b/);
  });

  test("tone='outline' is explicit and emits btn-outline", () => {
    const el = render({ variant: "success", tone: "outline", children: "Add" });
    expect(classNameOf(el)).toMatch(/\bbtn-outline\b/);
    expect(classNameOf(el)).not.toMatch(/\bbtn-solid\b/);
  });

  test("tone='solid' adds the btn-solid modifier class", () => {
    const el = render({
      variant: "danger",
      tone: "solid",
      children: "Delete forever",
    });
    expect(classNameOf(el)).toMatch(/\bbtn-solid\b/);
    expect(classNameOf(el)).toMatch(/\bbtn-danger\b/);
    expect(classNameOf(el)).not.toMatch(/\bbtn-outline\b/);
  });

  test("tone='solid' works on anchor form too (as='a')", () => {
    const el = render({
      as: "a",
      href: "/x",
      variant: "purple",
      tone: "solid",
      children: "Featured",
    });
    expect(classNameOf(el)).toMatch(/\bbtn-solid\b/);
    expect(classNameOf(el)).toMatch(/\bbtn-purple\b/);
    expect((el as unknown as { type: string }).type).toBe("a");
  });
});

describe("GOLD-STANDARD §03 — `[ ]` bracket aesthetic stays retired", () => {
  const css = readCss();

  test("no .btn-* pseudo-element injects literal bracket text", () => {
    const re = /\.btn[\w-]*::(?:before|after)\s*\{([^}]*)\}/g;
    let match;
    while ((match = re.exec(css)) !== null) {
      expect(match[1]).not.toMatch(/content:\s*["'`].*\[/);
      expect(match[1]).not.toMatch(/content:\s*["'`].*\]/);
    }
  });
});
