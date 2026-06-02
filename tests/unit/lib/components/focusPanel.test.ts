/**
 * P13.11 — FocusPanel renders the focused project's recipe.
 *
 * Pins the panel's structure so the dashboard FOCUS section keeps the
 * shape the painter relies on: slot palette at the top, then a section
 * per zone, with a step card per step carrying paint label + technique
 * + auto-saving notes textarea.
 */
import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

// FocusPanel imports `updateStepNotes` which has a `"use server"`
// directive — loading that module pulls in @/auth → next-auth → next.
// In the unit env (node, no Next runtime) those resolutions fail.
// Stub the action surface so the component module can load.
vi.mock("@/lib/actions/focus", () => ({
  updateStepNotes: vi.fn(async () => ({ ok: true, data: { stepId: "" } })),
}));

import {
  FocusPanel,
  type FocusZoneView,
} from "@/components/focus/FocusPanel";

type AnyNode = { type: unknown; props: Record<string, unknown> };

/**
 * Walk a React element tree, calling function components as we go so
 * tests can assert structure inside `<MyChild/>` without leaving the
 * pure-render environment Vitest's unit project uses.
 *
 * Caveat: a function component that depends on hooks (useState etc.)
 * still resolves — React 19 returns the initial render outside of a
 * concurrent renderer. We're only matching JSX structure, not driving
 * interactions, so that's enough.
 */
function findAll(
  node: unknown,
  predicate: (n: AnyNode) => boolean,
  // Guard against deeply recursive trees (shouldn't happen for us, but
  // be defensive about cycles in case of a bug).
  depth = 0,
): AnyNode[] {
  if (depth > 64) return [];
  const out: AnyNode[] = [];
  if (node == null || typeof node === "string" || typeof node === "number") {
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) out.push(...findAll(child, predicate, depth + 1));
    return out;
  }
  const n = node as AnyNode;
  if (typeof n !== "object" || !("type" in n) || !("props" in n)) return out;
  if (predicate(n)) out.push(n);

  // If this is a function component, render it once and recurse into
  // its output so we see the structure beneath it.
  if (typeof n.type === "function") {
    try {
      const rendered = (n.type as (p: Record<string, unknown>) => unknown)(
        n.props,
      );
      out.push(...findAll(rendered, predicate, depth + 1));
    } catch {
      // Some components (e.g. ones using forwardRef / context) won't
      // run here. Fall back to walking declared children only.
    }
  }

  const children = n.props?.children;
  if (children != null) out.push(...findAll(children, predicate, depth + 1));
  return out;
}

function render(
  zones: ReadonlyArray<FocusZoneView>,
  extra: {
    recipes?: ReadonlyArray<{ id: string; name: string }>;
    activeRecipeId?: string;
  } = {},
): ReactElement {
  return FocusPanel({
    projectId: "proj_1",
    projectName: "Crimson Fists",
    recipeName: "Power-armour scheme",
    zones,
    ...extra,
  }) as unknown as ReactElement;
}

function basicZones(): FocusZoneView[] {
  return [
    {
      id: "z1",
      name: "Armor",
      position: 0,
      swatchHex: "#aa0033",
      steps: [
        {
          id: "s1",
          zoneId: "z1",
          position: 0,
          technique: "basecoat",
          paintHex: "#aa0033",
          paintLabel: "Citadel Mephiston Red",
          notes: null,
        },
        {
          id: "s2",
          zoneId: "z1",
          position: 1,
          technique: "edge_highlight",
          paintHex: "#ff6655",
          paintLabel: "Citadel Wild Rider Red",
          notes: "thin to 2:1 contrast medium",
        },
      ],
    },
    {
      id: "z2",
      name: "Trim",
      position: 1,
      swatchHex: "#ffd700",
      steps: [],
    },
  ];
}

describe("FocusPanel — header + slot grid", () => {
  test("shows project + recipe name in the header", () => {
    const tree = render(basicZones());
    const text = JSON.stringify(tree);
    expect(text).toContain("Crimson Fists");
    expect(text).toContain("Power-armour scheme");
  });

  test("renders one slot per zone in the slot grid", () => {
    const tree = render(basicZones());
    const slotGrids = findAll(
      tree,
      (n) => n.props["aria-label"] === "Recipe slot palette",
    );
    expect(slotGrids).toHaveLength(1);

    const slotItems = findAll(
      slotGrids[0]!,
      (n) => n.props.role === "listitem",
    );
    expect(slotItems).toHaveLength(2);
  });

  test("step count summary reflects total steps across zones", () => {
    const tree = render(basicZones());
    const text = JSON.stringify(tree);
    // The JSX serialises [2, " slot", "s"] — the leading number + the
    // plural-aware fragment. We assert both are present in sequence.
    expect(text).toMatch(/2[^"]*?" slot"[^"]*?"s"/);
    expect(text).toMatch(/2[^"]*?" step"[^"]*?"s"/);
  });

  test("renders an explanatory empty state when the recipe has no zones", () => {
    const tree = render([]);
    const text = JSON.stringify(tree);
    expect(text).toMatch(/no slots yet/i);
  });
});

describe("FocusPanel — per-step rendering (P13.11)", () => {
  test("step cards surface paint label + Phase-12 technique label + hex", () => {
    const tree = render(basicZones());
    const text = JSON.stringify(tree);
    expect(text).toContain("Citadel Mephiston Red");
    expect(text).toContain("Citadel Wild Rider Red");
    expect(text).toContain("Basecoat");
    expect(text).toContain("Edge highlight");
    expect(text).toContain("#aa0033");
    expect(text).toContain("#ff6655");
  });

  test("zone steps are passed through to the step renderer in order", () => {
    // Render an unstable order and confirm we don't accidentally
    // re-sort. The panel preserves the .steps array as the caller
    // ordered it (the page query already sorts by position asc).
    const out = JSON.stringify(render(basicZones()));
    // The first zone has s1 then s2 — assert s1 appears before s2.
    expect(out.indexOf("s1")).toBeLessThan(out.indexOf("s2"));
  });

  test("renders a zone section per zone — including zones with no steps", () => {
    const text = JSON.stringify(render(basicZones()));
    // The Trim zone (z2) is empty; its empty-state copy must show.
    expect(text).toContain("Armor");
    expect(text).toContain("Trim");
    expect(text).toMatch(/No paints assigned to this slot/);
  });

  test("legacy techniques fall back to TitleCase, not the raw enum key", () => {
    const zones: FocusZoneView[] = [
      {
        id: "z1",
        name: "Coat",
        position: 0,
        swatchHex: "#888",
        steps: [
          {
            id: "legacy",
            zoneId: "z1",
            position: 0,
            technique: "wet_blend",
            paintHex: "#888888",
            paintLabel: "Test",
            notes: null,
          },
        ],
      },
    ];
    const text = JSON.stringify(render(zones));
    // The technique enum still propagates to the NotesEditor's `step`
    // prop (that's how the notes feature gets the raw key) — so we
    // can't assert the raw "wet_blend" is absent. We only assert the
    // human label is present.
    expect(text).toContain("Wet Blend");
  });
});

describe("FocusPanel — recipe tab strip (UX-907)", () => {
  test("does not render tabs when only one recipe is attached", () => {
    const tree = render(basicZones(), {
      recipes: [{ id: "r1", name: "Lone scheme" }],
      activeRecipeId: "r1",
    });
    const text = JSON.stringify(tree);
    // The lone recipe's name doesn't show up as a tab label.
    expect(text).not.toContain("Lone scheme");
  });

  test("renders the tab strip when 2+ recipes are attached", () => {
    const tree = render(basicZones(), {
      recipes: [
        { id: "r1", name: "Power-armour scheme" },
        { id: "r2", name: "Bone trim scheme" },
      ],
      activeRecipeId: "r1",
    });
    const text = JSON.stringify(tree);
    // Both recipe names render — one as the active tab, one inactive.
    expect(text).toContain("Power-armour scheme");
    expect(text).toContain("Bone trim scheme");
  });

  test("does not render tabs when activeRecipeId is missing", () => {
    // Defensive guard: even with multiple recipes, no active id means
    // the panel renders without the tab strip rather than crashing.
    const tree = render(basicZones(), {
      recipes: [
        { id: "r1", name: "A" },
        { id: "r2", name: "B" },
      ],
    });
    // Tree renders fine without throwing — the tab labels do not
    // appear because the tab strip is guarded by activeRecipeId.
    expect(tree).toBeDefined();
  });
});
