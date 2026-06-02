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

describe("UX-1313 — pricing highlights one recommended tier", () => {
  const src = read("src/app/pricing/page.tsx");

  test("Pro Lifetime carries the highlight flag", () => {
    expect(src).toMatch(/tier:\s*"pro_lifetime"[\s\S]*?highlight:\s*true/);
  });

  test("the highlighted card renders a 'Best value' ribbon", () => {
    expect(src).toContain("Best value");
    expect(src).toContain("card.highlight ?");
  });

  test("the highlighted card gets an accent border + glow (no other tier does)", () => {
    expect(src).toContain("border-[var(--color-green)] shadow-[0_0_0_1px_var(--color-green)");
  });
});

describe("UX-1312 — gradient colour-picker button label is meaningful", () => {
  const src = read("src/components/tools/gradient/GradientClient.tsx");

  test("the ambiguous truncating 'Start…' label is gone", () => {
    expect(src).not.toContain("Start…");
  });

  test("the visible label matches the picker intent ('Pick')", () => {
    expect(src).toMatch(/aria-label=\{`Pick a \$\{label\.toLowerCase\(\)\} colour`\}[\s\S]*?Pick\s*<\/Button>/);
  });
});

describe("UX-1311 — recipe step swatch/delete hit boxes no longer overlap", () => {
  const src = read("src/components/recipes/StepRow.tsx");

  test("the × delete has its own non-overlapping 44px box (shrink-0 + tap-target)", () => {
    expect(src).toContain(
      'className="shrink-0 inline-flex items-center justify-center text-xs font-mono text-[var(--color-fg-subtle)] hover:text-[var(--color-red)] tap-target px-2"',
    );
  });

  test("the notes toggle is shrink-0 so the trailing cluster can't compress", () => {
    expect(src).toContain("lg:hidden shrink-0 inline-flex items-center justify-center tap-target");
  });
});

describe("UX-1310 — DELETE PROJECT drops to a red outline (quieter)", () => {
  test("the detail-page trigger uses variant=danger + tone=outline", () => {
    const src = read("src/components/projects/DeleteProjectButton.tsx");
    expect(src).toContain('variant="danger"');
    expect(src).toContain('tone="outline"');
  });

  test("the confirm modal keeps the SOLID red 'Delete forever' (no outline)", () => {
    const src = read("src/components/projects/DeleteProjectModal.tsx");
    const idx = src.indexOf("Delete forever");
    const block = src.slice(Math.max(0, idx - 400), idx);
    expect(block).toContain('variant="danger"');
    expect(block).not.toContain('tone="outline"');
  });
});

describe("UX-1308 — wishlist filters are 44px tappable chips", () => {
  const css = read("src/app/globals.css");
  const chip = read("src/components/ui/FilterChip.tsx");
  const filters = read("src/components/wishlist/WishlistFilters.tsx");

  test(".chip has a resting border + ground so it reads as a chip", () => {
    expect(css).toMatch(/\.chip\s*\{[\s\S]*?border:\s*1px solid var\(--color-border-strong\)/);
    expect(css).toMatch(/\.chip\s*\{[\s\S]*?background:\s*var\(--color-bg-elevated\)/);
  });

  test("FilterChip floors to 44px on touch via tap-target + exposes aria-pressed", () => {
    expect(chip).toContain('"chip tap-target"');
    expect(chip).toContain("aria-pressed={active}");
  });

  test("WishlistFilters uses the shared FilterChip (local Chip removed)", () => {
    expect(filters).toContain("import { FilterChip }");
    expect(filters).toContain("<FilterChip");
    expect(filters).not.toContain("function Chip(");
  });

  test("per-row status menu actions floor to tap-target", () => {
    const table = read("src/components/wishlist/WishlistTable.tsx");
    expect(table).toContain('"tap-target w-full text-left px-3 py-1.5');
  });
});

describe("UX-1305 — recipes list reflows to stacked cards below 768px", () => {
  const src = read("src/components/recipes/RecipesTable.tsx");

  test("a mobile card list renders below md, table hidden below md", () => {
    expect(src).toContain('<div className="md:hidden flex flex-col gap-2">');
    expect(src).toContain('<div className="hidden md:block frame overflow-x-auto">');
  });

  test("the card row exists and keeps Assign + Share as full-width buttons", () => {
    expect(src).toContain("function RecipeCardRow");
    // Both actions stretch (flex-1) so they never scroll off the edge.
    const cardIdx = src.indexOf("function RecipeCardRow");
    const cardBlock = src.slice(cardIdx);
    expect(cardBlock).toContain('className="flex-1"');
  });

  test("the desktop table is preserved (still semantic)", () => {
    expect(src).toContain("<table");
    expect(src).toContain("<thead");
  });
});

describe("UX-1304 — wishlist rows reflow to a stacked card below 768px", () => {
  const src = read("src/components/wishlist/WishlistTable.tsx");

  test("the row is flex-col on mobile, grid at md+ (no clipped STATUS pill)", () => {
    expect(src).toContain("flex flex-col gap-2 md:grid md:items-center md:gap-3");
  });

  test("the desktop grid template is md-gated (mobile has no grid columns)", () => {
    expect(src).toContain(
      "md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1fr)_80px_90px_110px_14px_140px]",
    );
    expect(src).not.toContain("grid-cols-[40px_minmax(0,2fr)_70px_14px_120px]");
  });

  test("the header strip is hidden below md (card is self-labelling)", () => {
    expect(src).toContain("hidden md:grid items-center gap-3 px-3 py-1.5");
  });

  test("inner wrappers dissolve into the grid on desktop via md:contents", () => {
    const occurrences = src.split("md:contents").length - 1;
    expect(occurrences).toBe(2);
  });
});

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
