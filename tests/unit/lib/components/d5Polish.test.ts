/**
 * D5 / M5 — project + recipe flow polish (2026-06-04).
 *
 * Pins the locked behaviours from DESKTOP §D5 / MOBILE §M5:
 *   - one prominent recipe CTA; Delete demoted to a danger-outline at the
 *     bottom of the header (never a prominent slot);
 *   - project DELETE stays danger-outline;
 *   - context-aware add-child copy ("+ Model" on a Unit);
 *   - breadcrumb keeps the parent chain visible;
 *   - the Ctrl+Z undo store + its StageCounter wiring.
 */
import { afterEach, describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  pushUndo,
  popUndo,
  canUndo,
  clearUndo,
  undoDepth,
} from "@/lib/undo/store";
import { childAddLabel } from "@/lib/progress";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("D5 — undo store (mm:undo handler side)", () => {
  afterEach(() => clearUndo());

  test("LIFO: the most-recent action is undone first", () => {
    const order: string[] = [];
    pushUndo({ label: "a", invert: () => void order.push("a") });
    pushUndo({ label: "b", invert: () => void order.push("b") });
    popUndo();
    popUndo();
    expect(order).toEqual(["b", "a"]);
  });

  test("popUndo runs the inverse + returns the entry", () => {
    let ran = false;
    pushUndo({ label: "bump", invert: () => void (ran = true) });
    const entry = popUndo();
    expect(ran).toBe(true);
    expect(entry?.label).toBe("bump");
  });

  test("popUndo on an empty stack returns null + runs nothing", () => {
    expect(popUndo()).toBeNull();
  });

  test("canUndo reflects whether anything is queued", () => {
    expect(canUndo()).toBe(false);
    pushUndo({ label: "x", invert: () => {} });
    expect(canUndo()).toBe(true);
    popUndo();
    expect(canUndo()).toBe(false);
  });

  test("the stack is bounded (does not grow without limit)", () => {
    for (let i = 0; i < 200; i++) {
      pushUndo({ label: String(i), invert: () => {} });
    }
    expect(undoDepth()).toBeLessThanOrEqual(50);
  });
});

describe("D5 — StageCounter wires the undo store to mm:undo", () => {
  const src = read("src/components/StageCounter.tsx");

  test("listens for the shared UNDO_EVENT and pops the undo stack", () => {
    expect(src).toContain("UNDO_EVENT");
    expect(src).toContain("popUndo()");
    expect(src).toContain("addEventListener(UNDO_EVENT");
  });

  test("a successful bump records an inverse bump", () => {
    expect(src).toContain("pushUndo({");
    expect(src).toContain("invert: () => onBump(stage,");
  });

  test("a successful set records an inverse set to the prior value", () => {
    expect(src).toContain("invert: () => onSet(stage, prevValue, false)");
  });

  test("undo replays do not re-record themselves (recordUndo=false)", () => {
    expect(src).toContain("recordUndo = true");
    expect(src).toContain("replayingUndo");
  });
});

describe("D5 — recipe header action discipline", () => {
  const src = read("src/components/recipes/RecipeHeader.tsx");

  test("Delete is a danger-outline, not a solid prominent button", () => {
    expect(src).toContain('variant="danger"');
    expect(src).toContain('tone="outline"');
  });

  test("Delete is demoted below the action cluster (not beside Share)", () => {
    // The Share button + the demoted delete are no longer in the same
    // flex cluster — the delete sits in its own bottom row.
    expect(src).toContain("Delete recipe");
    expect(src).toContain("demoted destructive action");
  });

  test("the delete confirm copy uses 'slot' not 'colour slot + step'", () => {
    expect(src).toContain("slot it contains");
    expect(src).not.toContain("colour slot + step");
  });
});

describe("D5 — project flows", () => {
  test("project DELETE stays danger-outline", () => {
    const src = read("src/components/projects/DeleteProjectButton.tsx");
    expect(src).toContain('variant="danger"');
    expect(src).toContain('tone="outline"');
  });

  test("context-aware add-child label: '+ Model' on a Unit, '+ Unit' otherwise", () => {
    expect(childAddLabel("Unit")).toBe("+ Model");
    expect(childAddLabel("Army")).toBe("+ Unit");
    expect(childAddLabel("Warband")).toBe("+ Unit");
  });

  test("project breadcrumb renders the ancestor chain", () => {
    const src = read("src/app/projects/[id]/page.tsx");
    expect(src).toContain("ancestors");
    expect(src).toContain("ancestors.unshift(parent)");
    expect(src).toContain("ancestors.map((a) => (");
  });
});
