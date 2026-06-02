/**
 * P15.x — Round-13 mobile/touch polish (ux-audit/findings_v13.json).
 *
 * Source-level regression pins for the non-planner v13 findings. Follows
 * the repo convention of asserting on source text for CSS / layout sizing
 * changes (the surfaces are use-client and virtualised, so render-testing
 * is brittle; the source strings are the contract).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("UX-1309 — live clock node is hydration-safe (no #418)", () => {
  const src = read("src/components/StatusBar.tsx");

  test("first render still uses the SSR placeholder so SSR/CSR agree", () => {
    expect(src).toContain('CLOCK_PLACEHOLDER = "--:--:--"');
    expect(src).toContain("useState<string>(CLOCK_PLACEHOLDER)");
  });

  test("the real time is only set inside useEffect (client-only)", () => {
    expect(src).toMatch(
      /useEffect\(\(\)\s*=>\s*\{\s*setTime\(formatTime\(new Date\(\)\)\)/,
    );
  });

  test("the TIME segment carries suppressHydrationWarning", () => {
    expect(src).toContain(
      '<Segment label="TIME" value={time} tone="neutral" suppressHydrationWarning />',
    );
  });
});

describe("UX-1306 — shared SegmentedControl gives the active segment a solid fill", () => {
  const css = read("src/app/globals.css");
  const primitive = read("src/components/ui/SegmentedControl.tsx");

  test(".segment-active takes a solid cyan fill + black text (visible active state)", () => {
    expect(css).toMatch(/\.segment-active\s*\{[\s\S]*?background:\s*var\(--color-cyan\)/);
    expect(css).toMatch(/\.segment-active\s*\{[\s\S]*?color:\s*var\(--color-bg\)/);
  });

  test("the primitive sets BOTH aria-selected (tab role) and aria-pressed", () => {
    expect(primitive).toContain('role="tab"');
    expect(primitive).toContain("aria-selected={active}");
    expect(primitive).toContain("aria-pressed={active}");
  });

  test("ATTACH RECIPE modal uses the shared SegmentedControl (no local TabButton)", () => {
    const src = read("src/components/recipes/AttachRecipeModal.tsx");
    expect(src).toContain("import { SegmentedControl }");
    expect(src).toContain("<SegmentedControl<Tab>");
    expect(src).not.toContain("function TabButton");
  });

  test("recipe editor pane switch uses the shared SegmentedControl", () => {
    const src = read("src/components/recipes/RecipeEditorClient.tsx");
    expect(src).toContain("import { SegmentedControl }");
    expect(src).toContain("<SegmentedControl<Pane>");
  });
});

describe("UX-1307 — in-app inputs/selects/textarea floor to 44px on touch", () => {
  const css = read("src/app/globals.css");

  test("a (pointer: coarse) block raises input/select/textarea to 44px", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?textarea\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("checkboxes/radios are excluded from the input floor", () => {
    expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
  });

  test("desktop is untouched — the input floor is coarse-pointer gated only", () => {
    // The bare `input, textarea, select { … }` rule carries only a
    // transition, never an unconditional min-height.
    const bareRule = css.match(/\ninput, textarea, select \{([\s\S]*?)\}/);
    expect(bareRule).not.toBeNull();
    expect(bareRule![1]).not.toContain("min-height");
  });
});

describe("UX-1314 — root /favicon.ico resolves (no 404 on load)", () => {
  test("app/favicon.ico exists so Next serves it at the root", () => {
    const p = path.resolve(__dirname, "../../../../src/app/favicon.ico");
    expect(fs.existsSync(p)).toBe(true);
  });

  test("the file is a valid ICO (magic bytes 00 00 01 00)", () => {
    const buf = fs.readFileSync(
      path.resolve(__dirname, "../../../../src/app/favicon.ico"),
    );
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x00, 0x01, 0x00]));
  });
});

describe("UX-1303 — library owned/★ toggles get a 44px tap area in card layout", () => {
  const src = read("src/components/library/InventoryControls.tsx");

  test("both compact toggles carry tap-target so the flex cluster can't shrink to the glyph", () => {
    const occurrences =
      src.split(
        "tap-target inline-flex justify-center items-center font-mono text-xs w-full h-full min-h-[40px]",
      ).length - 1;
    expect(occurrences).toBe(2);
  });
});
