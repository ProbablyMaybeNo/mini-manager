/**
 * P12.8 — Project detail header strip.
 *
 * Title + stat row + full-width progress bar. Replaces the prior
 * ad-hoc header on /projects/<id>. Ross's brief locks the layout:
 *   <h1 cyan> · type chip · faction · model count · status pill ·
 *     + Add unit (green CTA, right-aligned)
 *   <ProgressBar stretch height=14 percent={percent}> with the
 *     percent overlay centered.
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

describe("ProjectHeaderStrip component surface", () => {
  const src = read("src/components/ProjectHeaderStrip.tsx");

  test("title is delegated to EditableProjectTitle (R7-008)", () => {
    // R7-008 extracted the static cyan <h1> into a client component
    // that supports inline-rename. The cyan colour + glow now live in
    // EditableProjectTitle.tsx — pinned in its own test file.
    expect(src).toContain("EditableProjectTitle");
    expect(src).toContain(
      "<EditableProjectTitle projectId={projectId} name={name} />",
    );
  });

  test("type chip uses the existing TYPE_CHIP palette", () => {
    expect(src).toContain("type-chip-cyan");
    expect(src).toContain("type-chip-amber");
    expect(src).toContain("type-chip-purple");
    expect(src).toContain("type-chip-green");
  });

  test("status pill mapping covers all 8 DisplayStatus values", () => {
    for (const s of [
      "WISHLIST",
      "OWNED",
      "BUILDING",
      "PRIMING",
      "PAINTING",
      "BASING",
      "COMPLETE",
      "SHELVED",
    ]) {
      expect(src).toContain(s);
    }
  });

  test("Item 1 — the add affordance is the single unified AddChildMenu", () => {
    // Item 1 (batch/army-project-page) consolidated every add control
    // behind one "+ Add ▾" menu. The header strip no longer renders a
    // bespoke add Button itself — it delegates to AddChildMenu, which
    // owns the success-green trigger + the unit/terrain/model items.
    expect(src).toContain("AddChildMenu");
    expect(src).toContain(
      "<AddChildMenu projectId={projectId} parentType={type} />",
    );
    // No standalone add Button left on the strip.
    expect(src).not.toContain("childAddLabel");
  });

  test("UX-016 — the duplicate linear progress bar is removed", () => {
    // The header double-encoded completion (CircularProgress dial AND a
    // full-width linear bar showing the same percent within ~40px). UX-016
    // keeps the dial as the single hero stat and drops the linear bar +
    // its centered overlay + the ProgressBar import.
    expect(src).not.toContain("<ProgressBar");
    expect(src).not.toContain('import { ProgressBar }');
    expect(src).not.toContain("stretch");
  });

  test("PHASE-2 — header is a terminal panel with corner ticks + tech label", () => {
    // The project-detail header is the page's mission banner: a near-black
    // .panel carrying corner ticks and a coordinate-style tech label on the
    // top border (DESIGN_LANGUAGE §5/§7).
    expect(src).toContain("panel panel-ticks");
    expect(src).toContain("panel-label");
  });

  test("UX-016 — completion is the single hero CircularProgress dial", () => {
    // §7.1 — the recurring moodboard gauge is now the ONLY completion
    // encoding in the header, enlarged so it reads as the headline figure.
    expect(src).toContain("CircularProgress");
    expect(src).toContain("caption=\"DONE\"");
    expect(src).toContain("percent={percent}");
  });

  test("PHASE-2 — status renders as the solid colour-bar idiom (tone=bar)", () => {
    // §7.2 — the signature solid colour-bar with black text, matching the
    // mission table's status column.
    expect(src).toContain('tone="bar"');
  });

  test("v6-4 — header bar reads the live optimistic percent from StageProgressContext", () => {
    // The header bar must track stage bumps instantly instead of lagging
    // behind the revalidatePath round-trip. It reads useLiveProgressPercent
    // (server `percent` as the fallback) so a StageCounter bump moves the
    // bar at once.
    expect(src).toContain("useLiveProgressPercent");
    expect(src).toContain("useLiveProgressPercent(projectId, serverPercent)");
  });
});

describe("AddChildMenu — Item 1 single unified add control", () => {
  const src = read("src/components/projects/AddChildMenu.tsx");

  test("trigger uses the success variant (ADD/CREATE → green, no cyan)", () => {
    expect(src).toContain('variant="success"');
    expect(src).not.toContain('variant="primary"');
  });

  test("trigger is a real menu button (aria-haspopup + aria-expanded)", () => {
    expect(src).toContain('aria-haspopup="menu"');
    expect(src).toContain("aria-expanded={open}");
  });

  test("offers Add unit AND Add model, both nested under this project (2026-06-05)", () => {
    expect(src).toContain("`/projects/new?parent=${projectId}&type=Unit`");
    expect(src).toContain("Add unit");
    expect(src).toContain("`/projects/new?parent=${projectId}&type=Model`");
    expect(src).toContain("Add model");
  });

  test("only Army / Warband expose the menu; everything else renders nothing", () => {
    // Containment rules: a Unit can't add a unit/model from inside, a
    // Model hosts nothing, terrain is top-level only. The menu short-
    // circuits to null for any non-Army/Warband parent.
    expect(src).toContain(
      'parentType === "Army" || parentType === "Warband"',
    );
    expect(src).toContain("if (!canAdd) return null;");
  });

  test("does NOT offer Add terrain (terrain is top-level only now)", () => {
    expect(src).not.toContain("Add terrain");
    expect(src).not.toContain("type=Terrain Piece");
  });

  test("closes on click-away and Escape (matches WishlistToolsMenu)", () => {
    expect(src).toContain('document.addEventListener("mousedown"');
    expect(src).toContain('e.key === "Escape"');
  });
});

describe("StageCounter — v6-4 publishes optimistic percent to the header", () => {
  const src = read("src/components/StageCounter.tsx");

  test("publishes progressPercent(snap) on each optimistic snapshot change", () => {
    expect(src).toContain("useStageProgressPublisher");
    expect(src).toContain("progressPercent");
    expect(src).toContain("publish(snap.id, progressPercent(snap))");
  });

  test("clears its published value on unmount so it can't go stale", () => {
    expect(src).toContain("return () => clear(snapshot.id)");
  });
});

describe("StageProgressContext — provider + hooks contract", () => {
  const src = read("src/components/projects/StageProgressContext.tsx");

  test("exposes a provider, a reader hook, and a publisher hook", () => {
    expect(src).toContain("export function StageProgressProvider");
    expect(src).toContain("export function useLiveProgressPercent");
    expect(src).toContain("export function useStageProgressPublisher");
  });

  test("reader falls back to the server percent when nothing is published", () => {
    expect(src).toContain("return live ?? serverPercent");
  });

  test("hooks are no-ops outside a provider so consumers stay portable", () => {
    expect(src).toContain("if (!ctx) return serverPercent");
    expect(src).toContain("return { publish: () => {}, clear: () => {} }");
  });
});

describe("StageProgressProvider stays a mountable workspace primitive", () => {
  // FIGMA-REBUILD §9 — the /projects/[id] detail PAGE (which wrapped its
  // header + stages in <StageProgressProvider> and printed a `SYS ▸ <TYPE>`
  // banner) was dissolved into the compact slide-out ProjectInspector. The
  // provider primitive + the header strip components are preserved intact
  // for reuse; their contracts are pinned in the describes above. The route
  // is now a permanent redirect into the dashboard inspector.
  const provider = read("src/components/projects/StageProgressContext.tsx");
  const route = read("src/app/projects/[id]/page.tsx");

  test("the provider renders children under its context (mountable)", () => {
    expect(provider).toContain("export function StageProgressProvider");
    expect(provider).toContain(".Provider");
  });

  test("the detail route redirects into the dashboard inspector", () => {
    expect(route).toContain("redirect(");
    expect(route).toContain("/projects?project=");
  });
});

describe("ProgressBar — stretch + height props (P12.8)", () => {
  const src = read("src/components/ProgressBar.tsx");

  test("ProgressBar accepts a `stretch` prop for full-width layout", () => {
    expect(src).toContain("stretch?: boolean");
  });

  test("ProgressBar accepts a `height` prop", () => {
    expect(src).toContain("height?: number");
  });

  test("stretch mode renders block + w-full + no inline width", () => {
    expect(src).toContain('"block w-full"');
    expect(src).toContain('{ height: `${height}px` }');
  });
});

describe("ProjectHeaderStrip + AddChildMenu gating survive the rebuild", () => {
  // FIGMA-REBUILD §9 — the header strip was a full-PAGE element; the page is
  // now a redirect, so the page-level "imports ProjectHeaderStrip /
  // showAddChild / canAddChild" wiring no longer lives in the route. The
  // strip component keeps its showAddChild prop and the Army/Warband add
  // gating lives in AddChildMenu (canAdd), where it's containment-correct
  // regardless of which surface mounts it.
  const strip = read("src/components/ProjectHeaderStrip.tsx");
  const menu = read("src/components/projects/AddChildMenu.tsx");

  test("the strip never re-rolls a bespoke inline header pill", () => {
    expect(strip).not.toContain("HEADER_STATUS_PILL");
  });

  test("the strip exposes a showAddChild prop (container vs leaf)", () => {
    expect(strip).toContain("showAddChild");
  });

  test("the add menu is gated to Army/Warband only (containment rule)", () => {
    // A Unit no longer shows the in-project add menu; the gate moved into
    // AddChildMenu so it holds on every mount surface.
    expect(menu).toContain('parentType === "Army" || parentType === "Warband"');
    expect(menu).toContain("if (!canAdd) return null;");
  });
});
