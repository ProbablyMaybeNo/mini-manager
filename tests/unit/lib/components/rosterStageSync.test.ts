/**
 * v6-4 bug fix — assigning a stage right after filling the roster.
 *
 * Walkthrough bug: after adding 10 owned models to a unit's roster, the
 * painter assigned a stage and hit "no unit added to the roster".
 *
 * Root cause: the "Roster" card (OwnedCounter) and the "Stages" card
 * (StageCounter) are separate client components with independent
 * optimistic state. The OwnedCounter owns the OWNED tier; the
 * StageCounter validates BUILD's cascade ceiling against OWNED. After an
 * optimistic OWNED bump the StageCounter's `ownedCount` stayed at the
 * stale server value until the revalidatePath round-trip landed, so the
 * cascade rejected BUILD with "Build can't exceed Owned (0)".
 *
 * Fix: a shared RosterContext. The OwnedCounter publishes its optimistic
 * OWNED count; the StageCounter reads it via useLiveOwnedCount and
 * validates against the live roster.
 *
 * Behavioural cascade pin (the value that actually broke) lives here too,
 * exercising the pure validateBump with stale vs live OWNED.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { validateBump } from "@/lib/counters/cascade";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("Cascade — BUILD validates against the live roster, not a stale 0", () => {
  const base = {
    count: 10,
    buildCount: 0,
    primeCount: 0,
    paintCount: 0,
    baseCount: 0,
    completeCount: 0,
  };

  test("stale owned=0 rejects the BUILD bump (the original bug)", () => {
    const r = validateBump({ ...base, ownedCount: 0 }, "build", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Owned (0)");
  });

  test("live owned=10 (filled roster) allows the BUILD bump", () => {
    const r = validateBump({ ...base, ownedCount: 10 }, "build", 1);
    expect(r.ok).toBe(true);
  });
});

describe("RosterContext — shared live OWNED count", () => {
  const src = read("src/components/projects/RosterContext.tsx");

  test("exposes provider + reader + publisher", () => {
    expect(src).toContain("export function RosterProvider");
    expect(src).toContain("export function useLiveOwnedCount");
    expect(src).toContain("export function useRosterPublisher");
  });

  test("reader falls back to the server owned when nothing published", () => {
    expect(src).toContain("return live ?? serverOwned");
    expect(src).toContain("if (!ctx) return serverOwned");
  });
});

describe("OwnedCounter — publishes its optimistic OWNED count", () => {
  const src = read("src/components/OwnedCounter.tsx");

  test("uses the roster publisher and publishes snap.ownedCount", () => {
    expect(src).toContain("useRosterPublisher");
    expect(src).toContain("publishOwned(snap.id, snap.ownedCount)");
  });

  test("clears its published value on unmount", () => {
    expect(src).toContain("return () => clearOwned(snapshot.id)");
  });
});

describe("StageCounter — validates BUILD against the live roster", () => {
  const src = read("src/components/StageCounter.tsx");

  test("reads the live owned count and builds an effectiveSnap", () => {
    expect(src).toContain("useLiveOwnedCount");
    expect(src).toContain("useLiveOwnedCount(snap.id, snap.ownedCount)");
    expect(src).toContain("effectiveSnap");
  });

  test("the +/- enable checks validate against effectiveSnap, not the stale snap", () => {
    expect(src).toContain("validateBump(effectiveSnap, stage, 1).ok");
    expect(src).toContain("validateBump(effectiveSnap, stage, -1).ok");
  });

  test("the bump-time ref carries the live OWNED tier", () => {
    expect(src).toContain("snapRef.current = effectiveSnap");
  });
});

describe("RosterProvider stays a self-contained, mountable primitive", () => {
  // FIGMA-REBUILD §9 — the leaf-project Roster/Stages WORKSPACE that
  // wrapped its counters in <RosterProvider> on the old /projects/[id]
  // page was dissolved (detail is now the compact slide-out inspector).
  // The provider itself is preserved intact — a general-purpose context
  // the Roster/Stages counter cluster wraps wherever it re-mounts — so the
  // OWNED-sync fix can't regress when that workspace is re-introduced. Its
  // provider/reader/publisher contract is pinned in the describe above.
  const src = read("src/components/projects/RosterContext.tsx");

  test("the provider renders its children under the context (mountable)", () => {
    expect(src).toContain("export function RosterProvider");
    expect(src).toContain(".Provider");
    expect(src).toContain("children");
  });
});
