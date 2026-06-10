/**
 * P15.3 — Mobile page-by-page polish (Round 12 audit).
 *
 * Source-level regression pins for the app-wide mobile polish pass. Each
 * block locks a single finding from ux-audit/findings_v12.json so a later
 * refactor can't silently regress the fix. Follows the repo convention of
 * asserting on source text for CSS / layout sizing changes.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("UX-1201 / UX-1507 — .btn-sm/.btn-md floor to 44px on mobile", () => {
  const css = read("src/app/globals.css");

  // UX-1507 root-cause: the gate must include a WIDTH query, not just
  // (pointer: coarse) — coarse-only never matched on mobile viewports.
  test("the button floor is gated on width (max-width: 767px), not pointer alone", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\),\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.btn-sm\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("the same mobile block also floors .btn-md", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\),\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.btn-md\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("desktop .btn-sm stays 28px (no min-height bump outside the query)", () => {
    expect(css).toContain(".btn-sm { padding: 4px 10px; min-height: 28px;");
  });
});

describe("UX-1212 — iOS standalone meta + viewport-fit for safe areas", () => {
  const layout = read("src/app/layout.tsx");

  test("metadata.other adds the unprefixed mobile-web-app-capable", () => {
    expect(layout).toContain('"mobile-web-app-capable": "yes"');
  });

  test("appleWebApp.capable remains true (emits the apple-prefixed meta)", () => {
    expect(layout).toMatch(/appleWebApp:\s*\{[\s\S]*?capable:\s*true/);
  });

  test("viewport opts into viewport-fit: cover for notch safe areas", () => {
    expect(layout).toContain('viewportFit: "cover"');
  });

  test("fixed chrome pads for safe-area insets", () => {
    const header = read("src/components/MobileHeader.tsx");
    const tabbar = read("src/components/BottomTabBar.tsx");
    expect(header).toContain("env(safe-area-inset-top");
    expect(tabbar).toContain("env(safe-area-inset-bottom");
  });
});

describe("UX-1206 — eyedropper camera button is post-mount gated (no #418)", () => {
  const src = read("src/components/tools/eyedropper/EyedropperClient.tsx");

  test("a mounted flag is set in an effect", () => {
    expect(src).toContain("const [mounted, setMounted] = useState(false)");
    expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setMounted\(true\);?\s*\}/);
  });

  test("camera visibility derives from mounted && support, not raw support", () => {
    expect(src).toContain("mounted && isCameraSamplerSupported");
    expect(src).toContain("{cameraAvailable ? (");
    expect(src).not.toContain("{isCameraSamplerSupported ? (");
  });
});

describe("UX-1207 — eyedropper empty-state copy is layout-agnostic", () => {
  const src = read("src/components/tools/eyedropper/EyedropperClient.tsx");

  test("no 'on the left' directional copy", () => {
    expect(src).not.toContain("Drop one on the left");
  });

  test("copy is direction-neutral", () => {
    expect(src).toContain("No image yet — drop or choose one to extract colours.");
  });
});

describe("UX-1205 — /user FREE caps match the /pricing locked truth", () => {
  const user = read("src/app/user/page.tsx");

  test("/user FREE feature list states the real caps", () => {
    expect(user).toContain('"1 project"');
    expect(user).toContain('"1 recipe"');
    expect(user).toContain('"3 wishlist items"');
  });

  test("/user no longer claims unlimited / no-caps for FREE", () => {
    expect(user).not.toContain("Every feature, no caps");
    expect(user).not.toContain("Free covers every feature");
    // Unlimited projects belongs to the paid tiers (on /pricing), not Free.
    expect(user).not.toMatch(/FREE:\s*\[[\s\S]*?Unlimited projects/);
  });

  test("/pricing FREE caps are the unchanged source of truth", () => {
    const pricing = read("src/app/pricing/page.tsx");
    expect(pricing).toContain('"1 project"');
    expect(pricing).toContain('"1 recipe"');
    expect(pricing).toContain('"3 wishlist items"');
  });
});

describe("UX-1211 — sub-AA separator dots fixed", () => {
  // The StatusBar separator assertion was retired with the StatusBar
  // itself (UI-CHROME — the non-functional desktop status strip was
  // removed). The eyedropper separator below is the remaining surface.
  test("eyedropper pin-list separator is aria-hidden (decorative)", () => {
    const src = read("src/components/tools/eyedropper/EyedropperPins.tsx");
    expect(src).toContain('<span aria-hidden className="opacity-50">·</span>');
  });
});

describe("UX-1209 — auth hero capped on mobile so the form clears the fold", () => {
  // FIGMA-REBUILD §10 — every auth surface now renders through the shared
  // AuthShell, which owns the capped CRT-logo hero (max-w-[140px] on mobile,
  // wider at md+). The per-page logo wrapper is gone; the cap lives once in
  // AuthShell.
  const shell = read("src/components/auth/AuthShell.tsx");

  test("AuthShell caps the logo hero on mobile, full width at md+", () => {
    expect(shell).toContain("max-w-[140px] md:max-w-[220px]");
  });

  test("sign-in + sign-up render through the shared AuthShell", () => {
    expect(read("src/app/sign-in/page.tsx")).toContain("<AuthShell");
    expect(read("src/app/sign-up/page.tsx")).toContain("<AuthShell");
  });
});

describe("UX-1208 — DELETE PROJECT reads as destructive + has a confirm", () => {
  test("the project inspector uses the danger DeleteProjectButton, not an inline text-link", () => {
    // FIGMA-REBUILD §9 — the /projects/[id] detail PAGE became a slide-out
    // ProjectInspector. The delete trigger moved there: a DeleteProjectButton
    // with redirect-to-projects-on-success and NO `inline` prop (so it falls
    // through to the solid variant="danger" Button).
    const src = read("src/components/projects/ProjectInspector.tsx");
    const idx = src.indexOf("<DeleteProjectButton");
    expect(idx).toBeGreaterThan(0);
    const block = src.slice(idx, src.indexOf("/>", idx));
    expect(block).not.toContain("inline");
    expect(block).toContain("redirectToProjectsOnSuccess");
  });

  test("the non-inline trigger renders variant=danger", () => {
    const src = read("src/components/projects/DeleteProjectButton.tsx");
    expect(src).toContain('variant="danger"');
  });

  test("a confirm modal guards the delete (not undoable)", () => {
    const src = read("src/components/projects/DeleteProjectModal.tsx");
    expect(src).toContain("This action cannot be undone");
    expect(src).toContain("Delete forever");
  });
});

describe("UX-1214 — FOCUS per-paint note surfaces its cross-project scope", () => {
  const src = read("src/components/focus/FocusPanel.tsx");

  test("a dedicated helper states the note applies everywhere", () => {
    expect(src).toContain("This note shows everywhere you use this paint.");
  });

  test("the helper lives in the PaintNoteEditor (after the textarea)", () => {
    const editorIdx = src.indexOf("function PaintNoteEditor");
    const helperIdx = src.indexOf("This note shows everywhere you use this paint.");
    expect(editorIdx).toBeGreaterThan(0);
    expect(helperIdx).toBeGreaterThan(editorIdx);
  });
});

describe("UX-1204 — small checkbox/toggle hit areas expanded to ≥44px", () => {
  test("/user brand-filter row floors to tap-target full-width", () => {
    const src = read("src/components/user/LibraryBrandFilterCard.tsx");
    expect(src).toContain("tap-target w-full flex items-center gap-2");
  });

  test("/library owned + favourite toggles fill their cell (full row height)", () => {
    const src = read("src/components/library/InventoryControls.tsx");
    // Two compact toggles both fill the cell rather than wrapping the glyph.
    const occurrences = src.split(
      "inline-flex justify-center items-center font-mono text-xs w-full h-full min-h-[40px]",
    ).length - 1;
    expect(occurrences).toBe(2);
    expect(src).not.toContain("min-h-[24px] py-1");
  });

  test("FOCUS step-done checkbox already carries tap-target (P15.2, kept)", () => {
    const src = read("src/components/focus/StepCompletionCheckbox.tsx");
    expect(src).toContain("tap-target inline-flex items-center justify-center");
    expect(src).toContain("w-5 h-5"); // visual glyph unchanged
  });
});

describe("UX-1215 — library switches to card layout below 768px", () => {
  const src = read("src/components/library/LibraryTable.tsx");

  test("rows size per breakpoint so the card can be taller on mobile", () => {
    // D3 made the desktop branch density-aware (desktopRowHeight =
    // Comfortable 40 / Compact 32); the mobile 64px card branch is
    // unchanged.
    expect(src).toContain("ROW_HEIGHT_MOBILE = 64");
    expect(src).toContain("isMobile ? ROW_HEIGHT_MOBILE : desktopRowHeight");
  });

  test("the mobile card gives NAME a full-width line (no ambiguous truncation)", () => {
    // UX-1506 superseded the JS `if (isMobile)` branch with WIDTH-gated CSS;
    // the NAME still owns a full-width md:hidden flex-1 container on the card.
    expect(src).toContain('<div className="md:hidden flex-1 min-w-0">');
  });
});

describe("UX-1216 — recipe colour picker is a bottom sheet on mobile", () => {
  test("SlotList picker stacks as a bottom sheet on mobile, right drawer on desktop", () => {
    const src = read("src/components/recipes/SlotList.tsx");
    expect(src).toContain("fixed inset-0 z-50 flex flex-col md:flex-row");
    expect(src).toContain("w-full max-h-[88vh] md:max-h-none md:w-[480px]");
    expect(src).toContain("env(safe-area-inset-bottom");
  });

  test("ProjectColorSchemeBox picker mirrors the bottom-sheet treatment", () => {
    const src = read("src/components/ProjectColorSchemeBox.tsx");
    expect(src).toContain("fixed inset-0 z-50 flex flex-col md:flex-row");
    expect(src).toContain("w-full max-h-[88vh] md:max-h-none md:w-[480px]");
  });

  test("ColorPicker content keeps a right gutter (p-4) so actions aren't flush", () => {
    const src = read("src/components/ui/ColorPicker.tsx");
    expect(src).toContain('className="flex flex-col gap-4 p-4 overflow-y-auto"');
  });
});
