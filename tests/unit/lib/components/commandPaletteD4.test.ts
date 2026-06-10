/**
 * D4 — command palette & keyboard layer.
 *
 * Source-scan net (GlobalSearch is a use-client overlay) for the D4
 * acceptance [D §5]:
 *
 *   - Cmd/Ctrl+K opens the palette; `/` stays an alias.
 *   - A Commands section (navigation + actions) with inline <kbd>.
 *   - Visible NavRail trigger advertising ⌘K.
 *   - Ctrl+F focuses the universal search; Ctrl+Z fires the undo event.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("D4 — open bindings", () => {
  const src = read("src/components/search/GlobalSearch.tsx");

  test("Cmd/Ctrl+K opens the palette (works even while typing)", () => {
    expect(src).toMatch(/const mod = e\.metaKey \|\| e\.ctrlKey/);
    expect(src).toMatch(/mod && \(e\.key === "k" \|\| e\.key === "K"\)/);
  });

  test("`/` remains an alias (only when not typing in a field)", () => {
    expect(src).toMatch(/if \(e\.key !== "\/"\) return/);
    expect(src).toMatch(/if \(isTypingTarget\(e\.target\)\) return/);
  });

  test("Ctrl+F focuses the universal search (opens the palette)", () => {
    expect(src).toMatch(/mod && \(e\.key === "f" \|\| e\.key === "F"\)/);
  });

  test("Ctrl+Z dispatches the undo event (D5 handles the store)", () => {
    expect(src).toContain('export const UNDO_EVENT = "mm:undo"');
    expect(src).toMatch(/dispatchEvent\(new Event\(UNDO_EVENT\)\)/);
  });
});

describe("D4 — Commands section", () => {
  const src = read("src/components/search/GlobalSearch.tsx");

  test("surfaces navigation commands incl. Focus + Dashboard", () => {
    // FOCUS-DASH — /projects relabelled Dashboard, /planner relabelled Focus.
    expect(src).toMatch(/label: "Go to Dashboard"/);
    expect(src).toMatch(/label: "Go to Focus"/);
    expect(src).toMatch(/label: "Go to Library"/);
    expect(src).toMatch(/label: "Go to Recipes"/);
    expect(src).toMatch(/label: "Go to Tools"/);
    // FIGMA-REBUILD §8 — /collections + /wishlist merged into the singular
    // /collection; the nav command relabelled to match.
    expect(src).toMatch(/label: "Go to Collection"/);
  });

  test("surfaces action commands (New project, Toggle density)", () => {
    expect(src).toMatch(/label: "New project"/);
    expect(src).toMatch(/Toggle density/);
  });

  test("commands render first so nav/actions are the fastest path", () => {
    // flat builds commands before paint/wishlist hits.
    const cmdLoop = src.indexOf("for (const cmd of matchedCommands)");
    const paintLoop = src.indexOf("for (const hit of results.paints)");
    expect(cmdLoop).toBeGreaterThan(-1);
    expect(paintLoop).toBeGreaterThan(-1);
    expect(cmdLoop).toBeLessThan(paintLoop);
  });

  test("the Commands section is rendered with a heading", () => {
    expect(src).toMatch(/title=\{`Commands · \$\{commandHits\.length\}`\}/);
  });

  test("rows can show an inline <kbd> shortcut", () => {
    expect(src).toMatch(/hit\.shortcut \?/);
    expect(src).toMatch(/<kbd/);
  });

  test("activate runs a command's local action when present, else navigates", () => {
    expect(src).toMatch(/if \(hit\.run\) \{/);
    expect(src).toMatch(/if \(hit\.href\) router\.push\(hit\.href\)/);
  });
});

describe("D4 — visible NavRail trigger", () => {
  const nav = read("src/components/NavRail.tsx");

  test("NavRail has a command-palette button advertising ⌘K", () => {
    expect(nav).toMatch(/aria-label="Open command palette"/);
    expect(nav).toMatch(/aria-keyshortcuts="Meta\+K Control\+K"/);
    expect(nav).toMatch(/dispatchEvent\(new Event\(OPEN_SEARCH_EVENT\)\)/);
  });

  test("the trigger shows the ⌘K kbd hint when the rail is expanded", () => {
    expect(nav).toMatch(/⌘K/);
  });
});
