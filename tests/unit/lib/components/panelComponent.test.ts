/**
 * UX-003 — shared <Panel> component + no grey panel fills.
 *
 * Panel backgrounds are already pinned to the near-black token
 * (--color-bg-elevated = #0A0A0A) app-wide; the remaining drift risk is
 * panels being hand-built from the raw `.panel` class + a manually-placed
 * `.panel-label` span. <Panel> is the canonical wrapper that owns that
 * markup, so these source-sentinel assertions pin:
 *   - the component exists and exposes the bezel props (ticks/nested/
 *     transparent/label),
 *   - it renders the .panel CSS primitive (which carries the #0A0A0A fill
 *     + phosphor border) and not a grey/white fill,
 *   - the .panel CSS token resolves to the near-black surface, never grey,
 *   - the named surfaces (match results, focus standby) route through it.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../../../");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const panel = read("src/components/ui/Panel.tsx");
const css = read("src/app/globals.css");
const match = read("src/components/tools/match/MatchClient.tsx");
const planner = read("src/app/planner/page.tsx");

describe("UX-003 — <Panel> component", () => {
  test("renders the .panel CSS primitive", () => {
    expect(panel).toMatch(/"panel"/);
  });

  test("exposes the bezel props ticks / nested / transparent / label", () => {
    for (const prop of ["ticks", "nested", "transparent", "label"]) {
      expect(panel).toMatch(new RegExp(`\\b${prop}\\b`));
    }
  });

  test("ticks → .panel-ticks, label → .panel-label, nested → .panel-nested", () => {
    expect(panel).toMatch(/panel-ticks/);
    expect(panel).toMatch(/panel-label/);
    expect(panel).toMatch(/panel-nested/);
    expect(panel).toMatch(/panel-transparent/);
  });

  test("never hard-codes a grey or white fill", () => {
    expect(panel).not.toMatch(/bg-white|bg-gray|bg-zinc|bg-slate|#fff/i);
  });
});

describe("UX-003 — .panel surface is near-black, never grey", () => {
  function ruleBody(selector: string): string {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
    );
    return css.match(re)?.[1] ?? "";
  }
  test(".panel fills from --color-bg-elevated (the #0A0A0A token)", () => {
    expect(ruleBody(".panel")).toMatch(
      /background:\s*var\(--color-bg-elevated\)/,
    );
  });
  test("--color-bg-elevated is #0a0a0a (near-black, not a grey)", () => {
    expect(css).toMatch(/--color-bg-elevated:\s*#0a0a0a/i);
  });
});

describe("UX-003 — named surfaces route through <Panel>", () => {
  test("match results panel uses <Panel>", () => {
    expect(match).toMatch(/import\s*\{\s*Panel\s*\}/);
    expect(match).toMatch(/<Panel/);
    // The hand-rolled `className="relative panel"` + manual label span is gone.
    expect(match).not.toMatch(/className="relative panel"/);
  });
  test("focus standby empty-state uses <Panel>", () => {
    expect(planner).toMatch(/import\s*\{\s*Panel\s*\}/);
    expect(planner).toMatch(/<Panel/);
    expect(planner).not.toMatch(/className="panel /);
  });
});
