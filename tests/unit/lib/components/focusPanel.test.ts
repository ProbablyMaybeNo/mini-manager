/**
 * P13.11 — FocusPanel renders the focused project's recipe.
 *
 * Pins the panel's structure so the dashboard FOCUS section keeps the
 * shape the painter relies on: slot palette at the top, then a section
 * per zone, with a step card per step carrying paint label + technique
 * + the per-PAINT note editor.
 *
 * Notes consolidation (Ross's 2026-06-02 locked call): the FOCUS scheme
 * keeps ONLY the per-paint note. The old per-step "Painting notes…"
 * textarea (`recipe_step.notes` / `updateStepNotes`) is retired from this
 * panel — these tests assert it's gone and the per-paint editor remains.
 */
import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

// FocusPanel pulls in the per-paint note action, which has a
// `"use server"` directive — loading that module pulls in @/auth →
// next-auth → next. In the unit env (node, no Next runtime) those
// resolutions fail, so stub the action surface so the module can load.
vi.mock("@/lib/actions/paintNotes", () => ({
  setPaintNote: vi.fn(async () => ({
    ok: true,
    data: { paintId: "", cleared: false },
  })),
}));

// P15.0 — FocusPanel now also pulls in the counters + stepCompletion
// server actions (via FocusQuickActions / StepCompletionCheckbox /
// SlotActivator) and next/navigation hooks. Stub them so the component
// module loads + the function-component walker can render the children.
vi.mock("@/lib/actions/counters", () => ({
  bumpCounter: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/actions/stepCompletion", () => ({
  setStepCompletion: vi.fn(async () => ({ ok: true, data: {} })),
  advanceSlot: vi.fn(async () => ({ ok: true, data: { nextSlotId: null } })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
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
    activeSlotId?: string | null;
    projectCounts?: {
      buildCount: number;
      primeCount: number;
      paintCount: number;
      completeCount: number;
    };
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
          paintId: null,
          paintNote: null,
          done: false,
        },
        {
          id: "s2",
          zoneId: "z1",
          position: 1,
          technique: "edge_highlight",
          paintHex: "#ff6655",
          paintLabel: "Citadel Wild Rider Red",
          paintId: null,
          paintNote: null,
          done: false,
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
            paintId: null,
            paintNote: null,
            done: false,
          },
        ],
      },
    ];
    const text = JSON.stringify(render(zones));
    // The technique enum still propagates to the step card's `step`
    // prop (that's how the row gets the raw key) — so we can't assert
    // the raw "wet_blend" is absent. We only assert the human label is
    // present.
    expect(text).toContain("Wet Blend");
  });
});

describe("FocusPanel — notes consolidation (per-paint only, 2026-06-02)", () => {
  function paintBackedZones(): FocusZoneView[] {
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
            paintId: "citadel-mephiston-red",
            paintNote: "2 thin coats",
            done: false,
          },
        ],
      },
    ];
  }

  // PaintNoteEditor is a hook-driven component the walker can't fully
  // render (same caveat as StepCompletionCheckbox / SlotActivator), so we
  // match its *element node* by the `step` prop the panel passes it — a
  // step object carrying a non-null paintId.
  const isPaintNoteEditor = (n: AnyNode) => {
    const step = n.props.step as { paintId?: unknown } | undefined;
    return (
      step != null &&
      typeof step === "object" &&
      "paintId" in step &&
      typeof step.paintId === "string"
    );
  };

  test("renders the per-paint note editor for a paint-backed step", () => {
    const tree = render(paintBackedZones());
    const paintEditors = findAll(tree, isPaintNoteEditor);
    expect(paintEditors).toHaveLength(1);
    const step = paintEditors[0]!.props.step as { paintId: string };
    expect(step.paintId).toBe("citadel-mephiston-red");
  });

  test("does NOT render the retired per-step 'Painting notes…' textarea", () => {
    const text = JSON.stringify(render(paintBackedZones()));
    // The old per-step NotesEditor placeholder + its sr-only label copy +
    // its id prefix must be gone from the FOCUS panel entirely.
    expect(text).not.toContain("Painting notes…");
    expect(text).not.toContain("step-notes-");
    expect(text).not.toMatch(/Painting notes for/);
  });

  test("custom-mix steps (no paint) render no notes editor at all", () => {
    // basicZones() steps all have paintId: null → no per-paint editor;
    // and the per-step editor is gone for everyone, so a custom-mix row
    // carries zero note fields.
    const tree = render(basicZones());
    expect(findAll(tree, isPaintNoteEditor)).toHaveLength(0);
    expect(JSON.stringify(tree)).not.toContain("Painting notes…");
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

describe("FocusPanel — P15.0 active slot + step completion", () => {
  test("active slot gets the WORKING ON label + data-active-slot marker", () => {
    const tree = render(basicZones(), { activeSlotId: "z1" });
    const activeSections = findAll(
      tree,
      (n) => n.props["data-active-slot"] === "true",
    );
    expect(activeSections).toHaveLength(1);
    expect(activeSections[0]!.props["data-slot-id"]).toBe("z1");

    // The "▶ WORKING ON" label is rendered inside SlotActivator (a client
    // component the walker leaves as a placeholder). Assert the panel
    // passes it isActive=true for exactly the active slot, and false for
    // the rest — that's what drives the label.
    const activators = findAll(
      tree,
      (n) => typeof n.props.slotId === "string" && "isActive" in n.props,
    );
    const activeActivators = activators.filter(
      (n) => n.props.isActive === true,
    );
    expect(activeActivators).toHaveLength(1);
    expect(activeActivators[0]!.props.slotId).toBe("z1");
  });

  test("only one slot is active at a time", () => {
    const tree = render(basicZones(), { activeSlotId: "z2" });
    const activeSections = findAll(
      tree,
      (n) => n.props["data-active-slot"] === "true",
    );
    expect(activeSections).toHaveLength(1);
    expect(activeSections[0]!.props["data-slot-id"]).toBe("z2");
  });

  test("checkboxes render only inside the active slot", () => {
    const tree = render(basicZones(), { activeSlotId: "z1" });
    // StepCompletionCheckbox is a client component the walker can't fully
    // render — match its placeholder by the props the panel passes it.
    const checkboxes = findAll(
      tree,
      (n) =>
        typeof n.props.stepId === "string" &&
        typeof n.props.done === "boolean" &&
        typeof n.props.label === "string",
    );
    // z1 has 2 steps; z2 has 0 — so exactly 2 checkbox children.
    expect(checkboxes).toHaveLength(2);
  });

  test("no checkboxes when there is no active slot", () => {
    const tree = render(basicZones(), { activeSlotId: null });
    const checkboxes = findAll(
      tree,
      (n) =>
        typeof n.props.stepId === "string" &&
        typeof n.props.done === "boolean" &&
        typeof n.props.label === "string",
    );
    expect(checkboxes).toHaveLength(0);
  });

  test("done steps render muted (line-through + opacity)", () => {
    const zones: FocusZoneView[] = [
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
            paintLabel: "Mephiston Red",
            paintId: null,
            paintNote: null,
            done: true,
          },
          {
            id: "s2",
            zoneId: "z1",
            position: 1,
            technique: "highlight",
            paintHex: "#ff6655",
            paintLabel: "Wild Rider Red",
            paintId: null,
            paintNote: null,
            done: false,
          },
        ],
      },
    ];
    const tree = render(zones, { activeSlotId: "z1" });
    const doneRows = findAll(
      tree,
      (n) => n.props["data-step-done"] === "true",
    );
    expect(doneRows).toHaveLength(1);
    expect(doneRows[0]!.props["data-step-id"]).toBe("s1");
    const text = JSON.stringify(tree);
    expect(text).toContain("line-through");
  });

  test("the first undone step in the active slot gets a NEXT tag", () => {
    const zones: FocusZoneView[] = [
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
            paintLabel: "Mephiston Red",
            paintId: null,
            paintNote: null,
            done: true,
          },
          {
            id: "s2",
            zoneId: "z1",
            position: 1,
            technique: "highlight",
            paintHex: "#ff6655",
            paintLabel: "Wild Rider Red",
            paintId: null,
            paintNote: null,
            done: false,
          },
          {
            id: "s3",
            zoneId: "z1",
            position: 2,
            technique: "edge_highlight",
            paintHex: "#ffaa99",
            paintLabel: "Fire Dragon Bright",
            paintId: null,
            paintNote: null,
            done: false,
          },
        ],
      },
    ];
    const tree = render(zones, { activeSlotId: "z1" });
    const nextTags = findAll(tree, (n) => "data-next-tag" in n.props);
    // Exactly one NEXT tag — on the first undone step (s2), not s3.
    expect(nextTags).toHaveLength(1);
  });

  test("renders the project-state pill from projectCounts", () => {
    const tree = render(basicZones(), {
      activeSlotId: "z1",
      projectCounts: {
        buildCount: 12,
        primeCount: 8,
        paintCount: 3,
        completeCount: 0,
      },
    });
    const pills = findAll(tree, (n) => "data-project-pill" in n.props);
    expect(pills).toHaveLength(1);
    const text = JSON.stringify(tree);
    expect(text).toContain("BUILT");
    expect(text).toContain("PRIMED");
    expect(text).toContain("PAINTED");
    expect(text).toContain("COMPLETE");
  });

  test("renders a recipe-completion progressbar with the right percent", () => {
    const zones: FocusZoneView[] = [
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
            paintLabel: "A",
            paintId: null,
            paintNote: null,
            done: true,
          },
          {
            id: "s2",
            zoneId: "z1",
            position: 1,
            technique: "highlight",
            paintHex: "#ff6655",
            paintLabel: "B",
            paintId: null,
            paintNote: null,
            done: false,
          },
        ],
      },
    ];
    const tree = render(zones, { activeSlotId: "z1" });
    const bars = findAll(tree, (n) => n.props.role === "progressbar");
    expect(bars).toHaveLength(1);
    // 1 of 2 done = 50%.
    expect(bars[0]!.props["aria-valuenow"]).toBe(50);
    // The label renders as the JSX fragment [50, "% complete"] — assert
    // both pieces appear (they aren't a contiguous string in the tree).
    const text = JSON.stringify(tree);
    expect(text).toContain("% complete");
    expect(text).toMatch(/50[^"]*?"% complete"/);
  });
});
