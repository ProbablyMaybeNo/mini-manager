/**
 * P13.5 — Optimistic counter discipline.
 *
 * Ross flagged stage counter bumps as feeling slow. The diagnosis:
 * `OwnedCounter` disabled its +/- buttons on `isPending`, blocking
 * rapid clicks while the server action was in flight even though
 * the optimistic update had already landed. `StageCounter` did NOT
 * have this guard (correct), and the fix is to bring `OwnedCounter`
 * in line with it.
 *
 * These source-level checks pin the discipline so a future PR can't
 * silently regress it. They read the component files as text because
 * the React render path here doesn't exercise the click handler (no
 * jsdom in this Vitest config) — and the source check catches the
 * exact regression we care about: re-introducing an `|| isPending`
 * on the +/- disabled prop.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("OwnedCounter — buttons stay clickable during the server round-trip (P13.5)", () => {
  const src = read("src/components/OwnedCounter.tsx");

  test("the increment button isn't gated on isPending", () => {
    // The Increment CounterButton call must read `disabled={!canIncrement}`
    // exactly — no `|| isPending` re-introduction.
    expect(src).toMatch(/disabled=\{!canIncrement\}/);
    expect(src).not.toMatch(/disabled=\{!canIncrement\s*\|\|\s*isPending\}/);
  });

  test("the decrement button isn't gated on isPending", () => {
    expect(src).toMatch(/disabled=\{!canDecrement\}/);
    expect(src).not.toMatch(/disabled=\{!canDecrement\s*\|\|\s*isPending\}/);
  });

  test("uses startTransition for the server call so bumps don't block the click", () => {
    expect(src).toContain("startTransition(async ()");
    // Optimistic update happens BEFORE the transition.
    const setSnapIdx = src.indexOf("setSnap(optimistic)");
    const startTxIdx = src.indexOf("startTransition(async");
    expect(setSnapIdx).toBeGreaterThan(-1);
    expect(startTxIdx).toBeGreaterThan(-1);
    expect(setSnapIdx).toBeLessThan(startTxIdx);
  });

  test("rolls back on server error", () => {
    expect(src).toMatch(/if \(!result\.ok\) \{[\s\S]*?setSnap\(prev\)/);
  });
});

describe("StageCounter — same optimistic discipline (P13.5 sentinel)", () => {
  const src = read("src/components/StageCounter.tsx");

  test("CounterButton call sites don't re-introduce isPending on disabled", () => {
    // Find the CounterButton call inside the StageRow. It should read
    // `disabled={!canDecrement}` and `disabled={!canIncrement}` —
    // never with `|| isPending`.
    expect(src).not.toMatch(/disabled=\{!canIncrement\s*\|\|\s*isPending\}/);
    expect(src).not.toMatch(/disabled=\{!canDecrement\s*\|\|\s*isPending\}/);
    expect(src).toMatch(/disabled=\{!canIncrement\}/);
    expect(src).toMatch(/disabled=\{!canDecrement\}/);
  });

  test("optimistic snapshot updates synchronously before the server call", () => {
    expect(src).toContain("setSnap(optimistic)");
    const setSnapIdx = src.indexOf("setSnap(optimistic)");
    const startTxIdx = src.indexOf("startTransition(async");
    expect(setSnapIdx).toBeLessThan(startTxIdx);
  });
});
