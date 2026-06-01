/**
 * P12.13 — Per-paint-row "Tools ▾" dropdown.
 *
 * The /wishlist Paints table now exposes a Tools menu next to each
 * row's status pill. Three menu items:
 *   - Wheel    → /tools/wheel?name=<title>
 *   - Match    → /tools/match?name=<title>
 *   - Layering → /tools/gradient?name=<title>
 *
 * The destination tools will accept the `name` query param in P12.16's
 * universal-Assign sweep. For now the menu navigates with the param
 * pre-attached so the wiring is forward-compatible.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("WishlistToolsMenu component surface", () => {
  const src = read("src/components/wishlist/WishlistToolsMenu.tsx");

  test("renders the locked three options: Wheel / Match / Layering", () => {
    // Labels appear as MenuLink children (typically on their own line
    // due to JSX formatting); use a multiline-friendly regex.
    expect(src).toMatch(/MenuLink[\s\S]{0,300}Wheel/);
    expect(src).toMatch(/MenuLink[\s\S]{0,300}Match/);
    expect(src).toMatch(/MenuLink[\s\S]{0,300}Layering/);
  });

  test("each menu item navigates to the right tool route", () => {
    expect(src).toContain("/tools/wheel");
    expect(src).toContain("/tools/match");
    // Layering URL stays /tools/gradient for back-compat per the plan.
    expect(src).toContain("/tools/gradient");
  });

  test("passes the paint title through as ?name= query param", () => {
    expect(src).toContain("URLSearchParams({ name: paintTitle })");
  });

  test("opens via 'Open in ▾' button (R7-010), closes on outside click + Escape", () => {
    // R7-010 renamed the trigger label from "Tools ▾" to "Open in ▾"
    // so it doesn't collide with the sidebar Tools page name. The
    // outside-click + Escape close handlers stay wired the same.
    expect(src).toContain("Open in ▾");
    // The old label survives only in the docblock that explains the
    // R7-010 rename — no JSX node should render it any more. Find the
    // line carrying the closing > and confirm the new label appears.
    const buttonIdx = src.indexOf("Open in ▾");
    const beforeButton = src.slice(0, buttonIdx);
    // The Button JSX node above the trigger label must NOT render the
    // old text.
    const lastButtonOpen = beforeButton.lastIndexOf("<Button");
    const buttonJsx = src.slice(lastButtonOpen, buttonIdx + 30);
    expect(buttonJsx).not.toContain("Tools ▾");
    expect(src).toContain('document.addEventListener("mousedown"');
    expect(src).toContain("Escape");
  });

  test("the trigger uses variant='ghost' (secondary affordance)", () => {
    // Tools is a secondary affordance — the row's status pill stays
    // the visual anchor, so the trigger is a low-key ghost button.
    expect(src).toMatch(/variant="ghost"/);
  });

  test("aria-haspopup + aria-expanded wired for screen readers", () => {
    expect(src).toContain('aria-haspopup="menu"');
    expect(src).toContain("aria-expanded={open}");
  });
});

describe("WishlistTable wires the Tools menu in for paints", () => {
  const src = read("src/components/wishlist/WishlistTable.tsx");

  test("imports WishlistToolsMenu", () => {
    expect(src).toContain("WishlistToolsMenu");
  });

  test("takes a `showTools` prop (default false)", () => {
    expect(src).toContain("showTools = false");
    expect(src).toContain("showTools?: boolean");
  });

  test("renders the menu only when showTools is true", () => {
    expect(src).toContain("{showTools ? (");
    expect(src).toContain("<WishlistToolsMenu paintTitle={item.title}");
  });
});

describe("/wishlist page passes showTools on the paints table only", () => {
  const src = read("src/app/wishlist/page.tsx");

  test("paints table opts in via `showTools`", () => {
    // Locate the Paints section in the source, confirm showTools is
    // set there. The Models section above must NOT carry it.
    const paintsIdx = src.indexOf('aria-label="Paints"');
    const modelsIdx = src.indexOf('aria-label="Models"');
    expect(paintsIdx).toBeGreaterThan(modelsIdx);
    // showTools prop appears in the paints section (after the Models
    // section markup is closed).
    const paintsBlock = src.slice(paintsIdx);
    expect(paintsBlock).toContain("showTools");
  });
});
