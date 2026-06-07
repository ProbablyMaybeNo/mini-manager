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

describe("UX-1311 — recipe slot delete affordance has its own corner hit box", () => {
  // 2026-06-04 flatten: the two-level StepRow (with its technique select +
  // notes toggle + × overlap risk) is gone. A slot is a single cell; its ×
  // delete lives in the top-right corner, separate from the main click
  // surface, so the overlap class of bug can't recur.
  const src = read("src/components/recipes/SlotList.tsx");

  test("the slot × delete sits in its own absolutely-positioned corner", () => {
    expect(src).toContain('aria-label={`Delete slot ${slotLabel}`}');
    expect(src).toContain("absolute top-1 right-1");
  });

  test("the slot's main click surface is a separate full-cell button", () => {
    expect(src).toContain('aria-label={`Edit slot ${slotLabel}`}');
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
    // Scope to the <footer> so docstring/comment mentions don't shadow the
    // real button: the confirm action is a SOLID danger button (no outline).
    const footer = src.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    expect(footer).toContain("Delete forever");
    expect(footer).toContain('variant="danger"');
    expect(footer).not.toContain('tone="outline"');
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

  // UX-1504 (Round 15) — the per-row STATUS trigger ("WISHLIST ▾") wrapped a
  // 21px StatusPill with no padding, and the project-tag trigger
  // ("OPEN IN ▾") was a 29px pill. Both now carry tap-target so the
  // *trigger* (not just the open menu) clears the 44px touch floor.
  test("the per-row STATUS trigger floors to tap-target (UX-1504)", () => {
    const table = read("src/components/wishlist/WishlistTable.tsx");
    expect(table).toContain('"tap-target inline-flex items-center justify-center"');
  });

  test("the project-tag (OPEN IN) trigger floors to tap-target (UX-1504)", () => {
    const menu = read("src/components/wishlist/TagToProjectMenu.tsx");
    expect(menu).toContain("tap-target inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 frame");
  });
});

describe("UX-1305 — recipes list reflows to stacked cards below 768px", () => {
  const src = read("src/components/recipes/RecipesTable.tsx");

  test("a mobile card list renders below md, table hidden below md", () => {
    expect(src).toContain('<div className="md:hidden flex flex-col gap-2">');
    // Terminal re-skin (batch/redesign-recipes): the dense desktop table
    // is wrapped in a `.panel` terminal frame (was a bare `.frame`), still
    // hidden below md + horizontally scrollable.
    expect(src).toContain('className="hidden md:block panel');
    expect(src).toContain("overflow-x-auto");
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
    // UX-017 added pr-4 (status-column right pad) between px-3 and py-1.5.
    expect(src).toContain("hidden md:grid items-center gap-3 px-3 pr-4 py-1.5");
  });

  test("UX-017 — desktop grid scrolls inside the bounded panel (no edge clip)", () => {
    // The panel is an x-scroll region and the grid floors to its natural
    // width (md:min-w-max) so the rightmost status control renders fully.
    expect(src).toContain("panel panel-ticks pt-1 overflow-x-auto");
    expect(src).toMatch(/md:min-w-max/);
  });

  test("inner wrappers dissolve into the grid on desktop via md:contents", () => {
    const occurrences = src.split("md:contents").length - 1;
    expect(occurrences).toBe(2);
  });
});

// UX-1309 — the live-clock hydration-safety block was retired with the
// StatusBar (UI-CHROME — the non-functional desktop status strip, which
// owned the SYS/NET/TIME segments, was removed). The general hydration
// regression guard now lives in tests/e2e/qa_hydration.spec.ts.

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

  // 2026-06-04 flatten: the recipe editor's SLOTS/NOTES pane switch was
  // removed — the flat editor renders the slot grid + notes side-by-side
  // with no segmented control. (The shared SegmentedControl primitive +
  // its other consumers are still covered above.)
  test("recipe editor no longer has a pane-switch SegmentedControl", () => {
    const src = read("src/components/recipes/RecipeEditorClient.tsx");
    expect(src).not.toContain("SegmentedControl");
  });
});

describe("UX-1307 / UX-1503 — in-app inputs/selects/textarea floor to 44px on mobile", () => {
  const css = read("src/app/globals.css");

  // UX-1503 root-cause: the recipe step <select> was still 25px because the
  // floor was gated on (pointer: coarse) alone, which doesn't apply on
  // mobile viewports. The WIDTH gate (max-width: 767px) makes it reliable.
  test("the input floor is gated on width (max-width: 767px), not pointer alone", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\),\s*\(max-width:\s*767px\)\s*\{[\s\S]*?textarea\s*\{[\s\S]*?min-height:\s*44px/,
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

describe("UX-1314 — app icon is served via app/icon.png", () => {
  // NOTE: the original UX-1314 fix shipped an app/favicon.ico, but that
  // file was a malformed ICO ("PNG is not in RGBA format") that FAILED
  // the Turbopack production build and blocked every deploy. It was
  // removed; Next's App Router generates the icon <link> from
  // app/icon.png (+ apple-icon.png), which is the real icon mechanism.
  // A valid root /favicon.ico is a follow-up (needs a real ICO encoder).
  test("app/icon.png exists so Next emits the favicon link", () => {
    const p = path.resolve(__dirname, "../../../../src/app/icon.png");
    expect(fs.existsSync(p)).toBe(true);
  });

  test("the build-breaking favicon.ico is gone", () => {
    const p = path.resolve(__dirname, "../../../../src/app/favicon.ico");
    expect(fs.existsSync(p)).toBe(false);
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
