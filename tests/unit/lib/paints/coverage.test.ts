/**
 * P16.1 — coverage primitives.
 *
 * Pins: coverage state mapping (owned beats wanted beats none),
 * summary roll-up math, and nearest-paints (excludes self, respects n,
 * nearest first).
 */
import { describe, expect, test } from "vitest";
import {
  coverageFor,
  coverageSummary,
  nearestPaintsByHue,
  type CoverageInventory,
} from "@/lib/paints/coverage";
import type { Paint } from "@/lib/paints/types";

const p = (overrides: Partial<Paint>): Paint => ({
  id: "p1",
  brand: "Citadel",
  line: "Base",
  name: "Test Paint",
  type: "Paint",
  hex: "#808080",
  hexConfidence: "high",
  hexSource: "stahly",
  sourceUrl: "https://example.com",
  ...overrides,
});

const inv = (
  entries: Array<[string, CoverageInventory]>,
): ReadonlyMap<string, CoverageInventory> => new Map(entries);

describe("coverageFor", () => {
  test("paint absent from the map → 'none'", () => {
    expect(coverageFor("x", inv([]))).toBe("none");
  });

  test("ownedCount > 0 → 'owned'", () => {
    expect(
      coverageFor("x", inv([["x", { ownedCount: 2, isWishlisted: false }]])),
    ).toBe("owned");
  });

  test("wishlisted and not owned → 'wanted'", () => {
    expect(
      coverageFor("x", inv([["x", { ownedCount: 0, isWishlisted: true }]])),
    ).toBe("wanted");
  });

  test("owned beats wanted — owned AND wishlisted → 'owned'", () => {
    expect(
      coverageFor("x", inv([["x", { ownedCount: 1, isWishlisted: true }]])),
    ).toBe("owned");
  });

  test("row exists but neither owned nor wishlisted → 'none'", () => {
    expect(
      coverageFor("x", inv([["x", { ownedCount: 0, isWishlisted: false }]])),
    ).toBe("none");
  });
});

describe("coverageSummary", () => {
  test("all-none for an empty inventory", () => {
    const paints = [p({ id: "a" }), p({ id: "b" }), p({ id: "c" })];
    const s = coverageSummary(paints, inv([]));
    expect(s).toEqual({ owned: 0, wanted: 0, total: 3, ownedPct: 0 });
  });

  test("counts owned and wanted buckets, ignores the rest", () => {
    const paints = [
      p({ id: "a" }),
      p({ id: "b" }),
      p({ id: "c" }),
      p({ id: "d" }),
    ];
    const s = coverageSummary(
      paints,
      inv([
        ["a", { ownedCount: 3, isWishlisted: false }],
        ["b", { ownedCount: 0, isWishlisted: true }],
        ["c", { ownedCount: 1, isWishlisted: true }], // owned wins
      ]),
    );
    expect(s.owned).toBe(2); // a + c
    expect(s.wanted).toBe(1); // b
    expect(s.total).toBe(4);
  });

  test("ownedPct is a rounded integer percentage of total", () => {
    const paints = Array.from({ length: 8 }, (_, i) => p({ id: `p${i}` }));
    const s = coverageSummary(
      paints,
      inv([
        ["p0", { ownedCount: 1, isWishlisted: false }],
        ["p1", { ownedCount: 1, isWishlisted: false }],
        ["p2", { ownedCount: 1, isWishlisted: false }],
      ]),
    );
    // 3 / 8 = 37.5 → rounds to 38
    expect(s.ownedPct).toBe(38);
  });

  test("ownedPct is 0 when there are no paints (no divide-by-zero)", () => {
    const s = coverageSummary([], inv([]));
    expect(s).toEqual({ owned: 0, wanted: 0, total: 0, ownedPct: 0 });
  });

  test("inventory entries for paints not in the catalog do not inflate counts", () => {
    const paints = [p({ id: "a" })];
    const s = coverageSummary(
      paints,
      inv([
        ["a", { ownedCount: 1, isWishlisted: false }],
        ["ghost", { ownedCount: 5, isWishlisted: false }],
      ]),
    );
    expect(s.owned).toBe(1);
    expect(s.total).toBe(1);
  });
});

describe("nearestPaintsByHue", () => {
  const target = p({ id: "target", hex: "#ff0000" }); // red
  const nearRed = p({ id: "near", hex: "#fe0202" });
  const orange = p({ id: "orange", hex: "#ff8800" });
  const green = p({ id: "green", hex: "#00ff00" });
  const blue = p({ id: "blue", hex: "#0000ff" });
  const pool = [target, nearRed, orange, green, blue];

  test("excludes the paint itself", () => {
    const res = nearestPaintsByHue(target, pool, 10);
    expect(res.map((x) => x.id)).not.toContain("target");
  });

  test("respects n", () => {
    expect(nearestPaintsByHue(target, pool, 2)).toHaveLength(2);
    expect(nearestPaintsByHue(target, pool, 0)).toHaveLength(0);
  });

  test("nearest colour first", () => {
    const res = nearestPaintsByHue(target, pool, 4);
    expect(res[0]!.id).toBe("near"); // almost-identical red is closest
    // furthest (green / blue) come last
    expect(res[res.length - 1]!.id === "green" || res[res.length - 1]!.id === "blue").toBe(
      true,
    );
  });

  test("n larger than the pool returns everything but self", () => {
    const res = nearestPaintsByHue(target, pool, 99);
    expect(res).toHaveLength(pool.length - 1);
  });

  test("deterministic tie-break on id for identical colours", () => {
    const a = p({ id: "aaa", hex: "#123456" });
    const b = p({ id: "bbb", hex: "#123456" });
    const res = nearestPaintsByHue(target, [target, b, a], 2);
    expect(res.map((x) => x.id)).toEqual(["aaa", "bbb"]);
  });
});
