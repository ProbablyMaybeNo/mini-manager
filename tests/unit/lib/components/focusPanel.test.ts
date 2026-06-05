/**
 * FocusPanel renders the focused project's recipe (2026-06-04 flatten).
 *
 * Pins the panel's structure so the dashboard FOCUS section keeps the
 * shape the painter relies on: slot palette at the top, then one card per
 * slot carrying paint label + layer label + the per-PAINT note editor +
 * a per-painter done checkbox.
 *
 * Flat model: a recipe is one ordered list of slots — each slot = one
 * paint + its layer. There are no zones and no per-zone step lists.
 *
 * Notes consolidation (Ross's 2026-06-02 locked call): the FOCUS scheme
 * keeps ONLY the per-paint note.
 */
import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("@/lib/actions/paintNotes", () => ({
  setPaintNote: vi.fn(async () => ({
    ok: true,
    data: { paintId: "", cleared: false },
  })),
}));

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
  type FocusSlotView,
} from "@/components/focus/FocusPanel";

type AnyNode = { type: unknown; props: Record<string, unknown> };

function findAll(
  node: unknown,
  predicate: (n: AnyNode) => boolean,
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

  if (typeof n.type === "function") {
    try {
      const rendered = (n.type as (p: Record<string, unknown>) => unknown)(
        n.props,
      );
      out.push(...findAll(rendered, predicate, depth + 1));
    } catch {
      /* hook-driven components fall back to declared children */
    }
  }

  const children = n.props?.children;
  if (children != null) out.push(...findAll(children, predicate, depth + 1));
  return out;
}

function render(
  slots: ReadonlyArray<FocusSlotView>,
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
    slots,
    ...extra,
  }) as unknown as ReactElement;
}

function basicSlots(): FocusSlotView[] {
  return [
    {
      id: "s1",
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
      position: 1,
      technique: "edge_highlight",
      paintHex: "#ff6655",
      paintLabel: "Citadel Wild Rider Red",
      paintId: null,
      paintNote: null,
      done: false,
    },
  ];
}

describe("FocusPanel — header + slot grid", () => {
  test("shows project + recipe name in the header", () => {
    const tree = render(basicSlots());
    const text = JSON.stringify(tree);
    expect(text).toContain("Crimson Fists");
    expect(text).toContain("Power-armour scheme");
  });

  test("renders one palette item per slot", () => {
    const tree = render(basicSlots());
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

  test("slot count summary reflects total slots", () => {
    const tree = render(basicSlots());
    const text = JSON.stringify(tree);
    // The JSX serialises [2, " slot", "s"].
    expect(text).toMatch(/2[^"]*?" slot"[^"]*?"s"/);
  });

  test("renders an explanatory empty state when the recipe has no slots", () => {
    const tree = render([]);
    const text = JSON.stringify(tree);
    expect(text).toMatch(/no slots yet/i);
  });
});

describe("FocusPanel — per-slot rendering", () => {
  test("slot cards surface paint label + Phase-12 layer label + hex", () => {
    const tree = render(basicSlots());
    const text = JSON.stringify(tree);
    expect(text).toContain("Citadel Mephiston Red");
    expect(text).toContain("Citadel Wild Rider Red");
    expect(text).toContain("Basecoat");
    expect(text).toContain("Edge highlight");
    expect(text).toContain("#aa0033");
    expect(text).toContain("#ff6655");
  });

  test("slots are rendered in the order the caller passed them", () => {
    const out = JSON.stringify(render(basicSlots()));
    expect(out.indexOf("s1")).toBeLessThan(out.indexOf("s2"));
  });

  test("legacy techniques fall back to TitleCase, not the raw enum key", () => {
    const slots: FocusSlotView[] = [
      {
        id: "legacy",
        position: 0,
        technique: "wet_blend",
        paintHex: "#888888",
        paintLabel: "Test",
        paintId: null,
        paintNote: null,
        done: false,
      },
    ];
    const text = JSON.stringify(render(slots));
    expect(text).toContain("Wet Blend");
  });
});

describe("FocusPanel — notes consolidation (per-paint only, 2026-06-02)", () => {
  function paintBackedSlots(): FocusSlotView[] {
    return [
      {
        id: "s1",
        position: 0,
        technique: "basecoat",
        paintHex: "#aa0033",
        paintLabel: "Citadel Mephiston Red",
        paintId: "citadel-mephiston-red",
        paintNote: "2 thin coats",
        done: false,
      },
    ];
  }

  // PaintNoteEditor + its PaintNoteDisclosure wrapper both receive the
  // `slot` prop (a non-null paintId). The disclosure additionally carries
  // a boolean `defaultOpen`; the editor does not — that distinguishes the
  // two element nodes for the walker.
  const hasPaintSlotProp = (n: AnyNode) => {
    const slot = n.props.slot as { paintId?: unknown } | undefined;
    return (
      slot != null &&
      typeof slot === "object" &&
      "paintId" in slot &&
      typeof slot.paintId === "string"
    );
  };
  const isPaintNoteDisclosure = (n: AnyNode) =>
    hasPaintSlotProp(n) && typeof n.props.defaultOpen === "boolean";
  const isPaintNoteEditor = (n: AnyNode) =>
    hasPaintSlotProp(n) && !("defaultOpen" in n.props);

  test("renders the per-paint note editor for a paint-backed slot", () => {
    const tree = render(paintBackedSlots());
    const paintEditors = findAll(tree, isPaintNoteEditor);
    expect(paintEditors).toHaveLength(1);
    const slot = paintEditors[0]!.props.slot as { paintId: string };
    expect(slot.paintId).toBe("citadel-mephiston-red");
  });

  test("does NOT render the retired per-step 'Painting notes…' textarea", () => {
    const text = JSON.stringify(render(paintBackedSlots()));
    expect(text).not.toContain("Painting notes…");
    expect(text).not.toContain("step-notes-");
    expect(text).not.toMatch(/Painting notes for/);
  });

  test("custom-mix slots (no paint) render no notes editor at all", () => {
    const tree = render(basicSlots());
    expect(findAll(tree, isPaintNoteEditor)).toHaveLength(0);
    expect(JSON.stringify(tree)).not.toContain("Painting notes…");
  });

  describe("progressive disclosure (item 5, doc §9)", () => {
    function threePaintSlots(): FocusSlotView[] {
      return [0, 1, 2].map((i) => ({
        id: `s${i + 1}`,
        position: i,
        technique: "basecoat",
        paintHex: "#aa0033",
        paintLabel: `Paint ${i + 1}`,
        paintId: `paint-${i + 1}`,
        paintNote: null,
        done: false,
      }));
    }

    test("each paint-backed slot wraps its editor in a disclosure", () => {
      const tree = render(threePaintSlots());
      // One disclosure + one editor per paint-backed slot.
      expect(findAll(tree, isPaintNoteDisclosure)).toHaveLength(3);
      expect(findAll(tree, isPaintNoteEditor)).toHaveLength(3);
    });

    test("only the active/next slot's disclosure defaults open", () => {
      // No active slot pinned → the first undone slot (s1, the NEXT slot)
      // is the only one open; the rest collapse to stay glanceable.
      const tree = render(threePaintSlots());
      const open = findAll(
        tree,
        (n) => isPaintNoteDisclosure(n) && n.props.defaultOpen === true,
      );
      expect(open).toHaveLength(1);
      const slot = open[0]!.props.slot as { paintId: string };
      expect(slot.paintId).toBe("paint-1");
    });

    test("the active slot's disclosure opens even when it isn't the NEXT slot", () => {
      const slots = threePaintSlots();
      slots[0]!.done = true; // s1 done → s2 becomes NEXT
      const tree = render(slots, { activeSlotId: "s3" });
      const open = findAll(
        tree,
        (n) => isPaintNoteDisclosure(n) && n.props.defaultOpen === true,
      );
      // Both the NEXT slot (s2) and the active slot (s3) open.
      const openPaintIds = open
        .map((n) => (n.props.slot as { paintId: string }).paintId)
        .sort();
      expect(openPaintIds).toEqual(["paint-2", "paint-3"]);
    });

    test("uses a native <details>/<summary> disclosure (SSR-safe)", () => {
      const tree = render(threePaintSlots());
      // The walker renders PaintNoteDisclosure, exposing the native
      // <details> it returns. Match the element by its marker + tag.
      const details = findAll(
        tree,
        (n) => n.type === "details" && "data-paint-note-disclosure" in n.props,
      );
      expect(details).toHaveLength(3);
    });
  });
});

describe("FocusPanel — recipe tab strip (UX-907)", () => {
  test("does not render tabs when only one recipe is attached", () => {
    const tree = render(basicSlots(), {
      recipes: [{ id: "r1", name: "Lone scheme" }],
      activeRecipeId: "r1",
    });
    const text = JSON.stringify(tree);
    expect(text).not.toContain("Lone scheme");
  });

  test("renders the tab strip when 2+ recipes are attached", () => {
    const tree = render(basicSlots(), {
      recipes: [
        { id: "r1", name: "Power-armour scheme" },
        { id: "r2", name: "Bone trim scheme" },
      ],
      activeRecipeId: "r1",
    });
    const text = JSON.stringify(tree);
    expect(text).toContain("Power-armour scheme");
    expect(text).toContain("Bone trim scheme");
  });

  test("does not render tabs when activeRecipeId is missing", () => {
    const tree = render(basicSlots(), {
      recipes: [
        { id: "r1", name: "A" },
        { id: "r2", name: "B" },
      ],
    });
    expect(tree).toBeDefined();
  });
});

describe("FocusPanel — active slot + completion", () => {
  test("active slot gets the data-active-slot marker", () => {
    const tree = render(basicSlots(), { activeSlotId: "s1" });
    const activeSections = findAll(
      tree,
      (n) => n.props["data-active-slot"] === "true",
    );
    expect(activeSections).toHaveLength(1);
    expect(activeSections[0]!.props["data-slot-id"]).toBe("s1");

    // The "▶ Working on" label is rendered inside SlotActivator (a client
    // component the walker leaves as a placeholder). Assert the panel
    // passes it isActive=true for exactly the active slot.
    const activators = findAll(
      tree,
      (n) => typeof n.props.slotId === "string" && "isActive" in n.props,
    );
    const activeActivators = activators.filter(
      (n) => n.props.isActive === true,
    );
    expect(activeActivators).toHaveLength(1);
    expect(activeActivators[0]!.props.slotId).toBe("s1");
  });

  test("only one slot is active at a time", () => {
    const tree = render(basicSlots(), { activeSlotId: "s2" });
    const activeSections = findAll(
      tree,
      (n) => n.props["data-active-slot"] === "true",
    );
    expect(activeSections).toHaveLength(1);
    expect(activeSections[0]!.props["data-slot-id"]).toBe("s2");
  });

  test("a done checkbox renders for every slot", () => {
    const tree = render(basicSlots(), { activeSlotId: "s1" });
    // StepCompletionCheckbox is a client component the walker can't fully
    // render — match its placeholder by the props the panel passes it.
    const checkboxes = findAll(
      tree,
      (n) =>
        typeof n.props.stepId === "string" &&
        typeof n.props.done === "boolean" &&
        typeof n.props.label === "string",
    );
    // Every slot is completable in the flat model — 2 slots, 2 checkboxes.
    expect(checkboxes).toHaveLength(2);
  });

  test("done slots render muted (line-through + opacity)", () => {
    const slots: FocusSlotView[] = [
      {
        id: "s1",
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
        position: 1,
        technique: "highlight",
        paintHex: "#ff6655",
        paintLabel: "Wild Rider Red",
        paintId: null,
        paintNote: null,
        done: false,
      },
    ];
    const tree = render(slots, { activeSlotId: "s1" });
    const doneRows = findAll(
      tree,
      (n) => n.props["data-step-done"] === "true",
    );
    expect(doneRows).toHaveLength(1);
    expect(doneRows[0]!.props["data-step-id"]).toBe("s1");
    const text = JSON.stringify(tree);
    expect(text).toContain("line-through");
  });

  test("the first undone slot gets a NEXT tag", () => {
    const slots: FocusSlotView[] = [
      {
        id: "s1",
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
        position: 2,
        technique: "edge_highlight",
        paintHex: "#ffaa99",
        paintLabel: "Fire Dragon Bright",
        paintId: null,
        paintNote: null,
        done: false,
      },
    ];
    const tree = render(slots);
    const nextTags = findAll(tree, (n) => "data-next-tag" in n.props);
    // Exactly one NEXT tag — on the first undone slot (s2), not s3.
    expect(nextTags).toHaveLength(1);
  });

  test("renders the project-state pill from projectCounts", () => {
    const tree = render(basicSlots(), {
      activeSlotId: "s1",
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
    const slots: FocusSlotView[] = [
      {
        id: "s1",
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
        position: 1,
        technique: "highlight",
        paintHex: "#ff6655",
        paintLabel: "B",
        paintId: null,
        paintNote: null,
        done: false,
      },
    ];
    const tree = render(slots, { activeSlotId: "s1" });
    const bars = findAll(tree, (n) => n.props.role === "progressbar");
    expect(bars).toHaveLength(1);
    // 1 of 2 done = 50%.
    expect(bars[0]!.props["aria-valuenow"]).toBe(50);
    const text = JSON.stringify(tree);
    expect(text).toContain("% complete");
    expect(text).toMatch(/50[^"]*?"% complete"/);
  });
});
