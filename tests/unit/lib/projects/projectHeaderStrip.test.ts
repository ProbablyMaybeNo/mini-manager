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
      "PURCHASED",
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

  test("the full-width progress bar uses stretch + height={14}", () => {
    expect(src).toContain("stretch");
    expect(src).toContain("height={14}");
  });

  test("the percent overlay sits absolutely centered above the bar", () => {
    expect(src).toContain("absolute inset-0 flex items-center justify-center");
    expect(src).toContain("{percent}%");
  });

  test("PHASE-2 — header is a terminal panel with corner ticks + tech label", () => {
    // The project-detail header is the page's mission banner: a near-black
    // .panel carrying corner ticks and a coordinate-style tech label on the
    // top border (DESIGN_LANGUAGE §5/§7).
    expect(src).toContain("panel panel-ticks");
    expect(src).toContain("panel-label");
  });

  test("PHASE-2 — headline completion reads as a phosphor CircularProgress dial", () => {
    // §7.1 — the recurring moodboard gauge. The dense linear bar stays for
    // the at-a-glance fill; the dial is the headline figure.
    expect(src).toContain("CircularProgress");
    expect(src).toContain("caption=\"DONE\"");
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

describe("Project detail page wraps the workspace in the progress provider", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("imports + mounts StageProgressProvider around header + stages", () => {
    expect(src).toContain("StageProgressProvider");
    expect(src).toContain("<StageProgressProvider>");
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

describe("Project detail page wires the new header strip in", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("imports ProjectHeaderStrip", () => {
    expect(src).toContain("ProjectHeaderStrip");
  });

  test("the old inline <h1> + StatusPill header block is gone", () => {
    // The prior header had `{status} · {percent}%` in a StatusPill;
    // P12.8 moves that into the component, so the page no longer
    // references HEADER_STATUS_PILL.
    expect(src).not.toContain("HEADER_STATUS_PILL");
  });

  test("page passes showAddChild based on project.type (container vs leaf)", () => {
    expect(src).toContain("showAddChild=");
    expect(src).toContain('project.type === "Army"');
  });

  test("2026-06-05 — the add menu is gated to Army/Warband only (canAddChild)", () => {
    // Containment rules: a Unit no longer shows the in-project add menu.
    // The page derives canAddChild = Army||Warband and feeds it to
    // showAddChild (separate from canHaveChildren, which still includes
    // Unit so assigned models still display).
    expect(src).toContain("const canAddChild =");
    expect(src).toMatch(
      /canAddChild =\s*project\.type === "Army" \|\| project\.type === "Warband"/,
    );
    expect(src).toContain("showAddChild={canAddChild}");
  });
});
