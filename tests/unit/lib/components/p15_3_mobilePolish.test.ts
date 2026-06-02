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

describe("UX-1201 — .btn-sm/.btn-md floor to 44px on coarse pointers", () => {
  const css = read("src/app/globals.css");

  test("a (pointer: coarse) media query raises .btn-sm to 44px", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.btn-sm\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("the same coarse-pointer block also floors .btn-md", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.btn-md\s*\{[\s\S]*?min-height:\s*44px/,
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
  test("StatusBar separator no longer uses the failing border-strong colour", () => {
    const src = read("src/components/StatusBar.tsx");
    expect(src).not.toContain('text-[var(--color-border-strong)]">·</span>');
    expect(src).toContain('<span aria-hidden className="text-[var(--color-fg-muted)]">·</span>');
  });

  test("eyedropper pin-list separator is aria-hidden (decorative)", () => {
    const src = read("src/components/tools/eyedropper/EyedropperPins.tsx");
    expect(src).toContain('<span aria-hidden className="opacity-50">·</span>');
  });
});

describe("UX-1209 — auth hero capped on mobile so the form clears the fold", () => {
  test("sign-up caps the logo at 150px on mobile, full width at md+", () => {
    const src = read("src/app/sign-up/page.tsx");
    expect(src).toContain('w-full max-w-[150px] md:max-w-none');
  });

  test("sign-in mirrors the capped hero", () => {
    const src = read("src/app/sign-in/page.tsx");
    expect(src).toContain('w-full max-w-[150px] md:max-w-none');
  });
});

describe("UX-1208 — DELETE PROJECT reads as destructive + has a confirm", () => {
  test("detail page uses the solid danger Button, not the inline text-link", () => {
    const src = read("src/app/projects/[id]/page.tsx");
    // The DeleteProjectButton block on the detail page no longer passes
    // `inline`, so it falls through to the variant="danger" solid Button.
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
