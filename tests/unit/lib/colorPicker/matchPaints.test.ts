import { describe, expect, test } from "vitest";
import type { Paint } from "@/lib/paints/types";
import {
  bandForHex,
  closerMatchesDeltaE,
  fastMatchByHueBand,
  MATCH_DEFAULT_DELTAE,
  MATCH_EXPANDED_DELTAE,
  matchesWithinDeltaE,
  libraryMatches,
  LIBRARY_ROW_CAP,
} from "@/lib/colorPicker/matchPaints";

/* P12.1 — ColorPicker paint-match helpers.
 *
 * Two passes:
 *   - fastMatchByHueBand: cheap categorical filter, used as the
 *     library sub-panel default.
 *   - closerMatchesDeltaE: perceptual sort, hidden behind a "Show
 *     closer matches" button. Defaults to top 20 (Ross's locked
 *     answer).
 *
 * Both are pure functions — fixture paints below, no DB. */

function paint(id: string, hex: string, name = id, brand = "X"): Paint {
  return {
    id,
    brand,
    name,
    type: "Paint",
    hex,
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "test://",
  };
}

const FIXTURES: Paint[] = [
  paint("red-1", "#FF0000", "Pure red"),
  paint("red-2", "#E10D17", "Crimson"),
  paint("orange-1", "#FF8800", "Sunset orange"),
  paint("yellow-1", "#FFD700", "Yellow"),
  paint("green-1", "#00CC00", "Green"),
  paint("green-2", "#22AA44", "Forest green"),
  paint("cyan-1", "#00CCCC", "Cyan"),
  paint("blue-1", "#0000FF", "Blue"),
  paint("violet-1", "#7733CC", "Violet"),
  paint("magenta-1", "#DD44AA", "Magenta"),
  paint("white", "#FFFFFF", "White"),
  paint("black", "#101010", "Near black"),
  paint("grey", "#808080", "Mid grey"),
  paint("malformed", "not-a-hex", "Junk"),
];

describe("bandForHex", () => {
  test("returns the correct band for pure primaries", () => {
    expect(bandForHex("#FF0000")).toBe("Red");
    expect(bandForHex("#FFAA00")).toBe("Orange");
    expect(bandForHex("#FFD700")).toBe("Yellow");
    expect(bandForHex("#00CC00")).toBe("Green");
    expect(bandForHex("#00CCCC")).toBe("Cyan");
    expect(bandForHex("#0000FF")).toBe("Blue");
    expect(bandForHex("#7733CC")).toBe("Violet");
    expect(bandForHex("#DD44AA")).toBe("Magenta");
  });

  test("returns null for greyscale picks (no hue)", () => {
    expect(bandForHex("#000000")).toBeNull();
    expect(bandForHex("#808080")).toBeNull();
    expect(bandForHex("#FFFFFF")).toBeNull();
  });

  test("returns null for malformed hex", () => {
    expect(bandForHex("garbage")).toBeNull();
    expect(bandForHex("#zzz")).toBeNull();
    expect(bandForHex("")).toBeNull();
  });
});

describe("fastMatchByHueBand", () => {
  test("returns paints whose hue lands in the same band as the picked hex", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES);
    const ids = out.map((p) => p.id);
    expect(ids).toContain("red-1");
    expect(ids).toContain("red-2");
    // Sibling bands are excluded.
    expect(ids).not.toContain("orange-1");
    expect(ids).not.toContain("magenta-1");
  });

  test("skips paints with malformed hex", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES);
    const ids = out.map((p) => p.id);
    expect(ids).not.toContain("malformed");
  });

  test("greyscale pick falls back to returning the full pool (capped)", () => {
    const out = fastMatchByHueBand("#808080", FIXTURES, { limit: 5 });
    expect(out.length).toBe(5);
  });

  test("respects the limit option", () => {
    const out = fastMatchByHueBand("#FF0000", FIXTURES, { limit: 1 });
    expect(out.length).toBe(1);
  });

  test("default limit is 50", () => {
    // Build a synthetic catalog of 60 same-band paints
    const reds: Paint[] = Array.from({ length: 60 }, (_, i) =>
      paint(`r${i}`, "#FF0000"),
    );
    const out = fastMatchByHueBand("#FF0000", reds);
    expect(out.length).toBe(50);
  });
});

describe("closerMatchesDeltaE", () => {
  test("ranks closer perceptual matches first", () => {
    // Picking pure red — red-1 (#FF0000) should rank above red-2 (#E10D17)
    // which should rank above orange-1.
    const out = closerMatchesDeltaE("#FF0000", FIXTURES);
    expect(out.length).toBeGreaterThan(0);
    // The first hit must be red-1 itself (deltaE ~ 0).
    expect(out[0]?.paint.id).toBe("red-1");
    // Sorted ascending by deltaE.
    for (let i = 1; i < out.length; i++) {
      const curr = out[i];
      const prev = out[i - 1];
      if (curr && prev) {
        expect(curr.deltaE).toBeGreaterThanOrEqual(prev.deltaE);
      }
    }
  });

  test("default limit is 20", () => {
    const many: Paint[] = Array.from({ length: 50 }, (_, i) =>
      paint(`p${i}`, `#${(i * 5).toString(16).padStart(2, "0")}FF00`),
    );
    const out = closerMatchesDeltaE("#FF0000", many);
    expect(out.length).toBe(20);
  });

  test("explicit limit caps the result count", () => {
    const out = closerMatchesDeltaE("#FF0000", FIXTURES, 3);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  test("malformed target hex returns no results", () => {
    const out = closerMatchesDeltaE("not-a-hex", FIXTURES);
    expect(out).toEqual([]);
  });
});

describe("matchesWithinDeltaE (UX-908)", () => {
  // The old hue-band default surfaced very-far paints like "Near black"
  // for a magenta pick simply because both fell in the red-purple band.
  // The new helper caps by perceptual ΔE so unrelated colours don't
  // pad the result list.

  test("defaults are sane — tight default, looser expanded", () => {
    expect(MATCH_DEFAULT_DELTAE).toBe(10);
    expect(MATCH_EXPANDED_DELTAE).toBeGreaterThan(MATCH_DEFAULT_DELTAE);
  });

  test("returns matches sorted ascending by ΔE", () => {
    const out = matchesWithinDeltaE("#FF0000", FIXTURES, 30);
    for (let i = 1; i < out.length; i++) {
      const curr = out[i];
      const prev = out[i - 1];
      if (curr && prev) {
        expect(curr.deltaE).toBeGreaterThanOrEqual(prev.deltaE);
      }
    }
  });

  test("caps results by perceptual distance, not by row count", () => {
    // Magenta pick. Every result must be within the cap; no far-off
    // greys / blacks should slip in just because the catalog has them.
    const out = matchesWithinDeltaE("#DD44AA", FIXTURES, 10);
    for (const m of out) {
      expect(m.deltaE).toBeLessThanOrEqual(10);
    }
    // The fixture's "Near black" sits >>10 ΔE from magenta — it must
    // be filtered out, even though both share the red-purple band.
    expect(out.map((m) => m.paint.id)).not.toContain("black");
  });

  test("a very tight cap can yield zero results", () => {
    // The fixture catalog has no near-perfect magenta — at ΔE ≤ 0.5,
    // the only qualifier would be a near-identical hex, and there
    // isn't one. The empty state is part of the user-facing fix.
    const out = matchesWithinDeltaE("#DD44AA", FIXTURES, 0.5);
    expect(out.length).toBeLessThanOrEqual(1);
  });

  test("expanded ΔE returns at least as many rows as default", () => {
    const tight = matchesWithinDeltaE("#FF0000", FIXTURES, MATCH_DEFAULT_DELTAE);
    const loose = matchesWithinDeltaE(
      "#FF0000",
      FIXTURES,
      MATCH_EXPANDED_DELTAE,
    );
    expect(loose.length).toBeGreaterThanOrEqual(tight.length);
  });

  test("malformed target hex returns no results", () => {
    const out = matchesWithinDeltaE("garbage", FIXTURES);
    expect(out).toEqual([]);
  });
});

describe("libraryMatches — the picker's library rows (audit B3)", () => {
  // Named fixtures standing in for the real catalog rows the audit used:
  // Abaddon Black is nowhere near a mid-blue slot colour, so the ΔE window
  // could never surface it — but searching its name has to.
  const CATALOG: Paint[] = [
    ...FIXTURES,
    paint("abaddon", "#151414", "Abaddon Black", "Citadel"),
    paint("mephiston", "#960C0C", "Mephiston Red", "Citadel"),
    paint("macragge", "#0D407F", "Macragge Blue", "Citadel"),
  ];
  /** A slot colour far from black — the exact reason the old filter failed. */
  const SLOT = "#1C2E44";

  test("with no query the ΔE window is unchanged", () => {
    const rows = libraryMatches(SLOT, CATALOG, { maxDeltaE: MATCH_DEFAULT_DELTAE });
    for (const r of rows) {
      expect(r.deltaE).not.toBeNull();
      expect(r.deltaE!).toBeLessThanOrEqual(MATCH_DEFAULT_DELTAE);
    }
    // The whole point: this window does NOT contain Abaddon Black.
    expect(rows.map((r) => r.paint.id)).not.toContain("abaddon");
  });

  test("searching a name finds a paint the ΔE window excludes", () => {
    // Pre-fix this returned 0 rows — "No paints within ΔE 10".
    const rows = libraryMatches(SLOT, CATALOG, { query: "Abaddon" });
    expect(rows.map((r) => r.paint.id)).toEqual(["abaddon"]);
  });

  test("searching is case-insensitive and covers name, brand and line", () => {
    expect(libraryMatches(SLOT, CATALOG, { query: "mephiston" })).toHaveLength(1);
    expect(
      libraryMatches(SLOT, CATALOG, { query: "citadel" }).map((r) => r.paint.id).sort(),
    ).toEqual(["abaddon", "macragge", "mephiston"]);
    const withLine = [...CATALOG, { ...paint("l1", "#123456", "Lined"), line: "Air" }];
    expect(libraryMatches(SLOT, withLine, { query: "air" }).map((r) => r.paint.id)).toEqual([
      "l1",
    ]);
  });

  test("search results keep their ΔE so the match badges still read", () => {
    const rows = libraryMatches(SLOT, CATALOG, { query: "citadel" });
    for (const r of rows) expect(typeof r.deltaE).toBe("number");
    // Nearest to the slot colour leads.
    expect(rows[0]?.paint.id).toBe("macragge");
  });

  test("search results survive an unparseable hex, without a distance", () => {
    const rows = libraryMatches(SLOT, CATALOG, { query: "Junk" });
    expect(rows.map((r) => r.paint.id)).toEqual(["malformed"]);
    expect(rows[0]?.deltaE).toBeNull();
  });

  test("the brand facet still ANDs with a search", () => {
    expect(
      libraryMatches(SLOT, CATALOG, { query: "black", brands: ["Citadel"] }).map(
        (r) => r.paint.id,
      ),
    ).toEqual(["abaddon"]);
    // Same query, the other company: Citadel's Abaddon Black is out of scope
    // and only the fixture brand's own "Near black" survives.
    expect(
      libraryMatches(SLOT, CATALOG, { query: "black", brands: ["X"] }).map((r) => r.paint.id),
    ).toEqual(["black"]);
  });

  test("the brand facet still ANDs with the ΔE window", () => {
    const rows = libraryMatches("#FF0000", CATALOG, {
      brands: ["Citadel"],
      maxDeltaE: MATCH_EXPANDED_DELTAE,
    });
    for (const r of rows) expect(r.paint.brand).toBe("Citadel");
  });

  test("a search that matches nothing returns no rows", () => {
    expect(libraryMatches(SLOT, CATALOG, { query: "zzzz-no-such-paint" })).toEqual([]);
  });

  test("a broad search is capped at the panel's row ceiling", () => {
    const many: Paint[] = Array.from({ length: LIBRARY_ROW_CAP + 40 }, (_, i) =>
      paint(`bulk${i}`, "#204060", `Bulk paint ${i}`),
    );
    expect(libraryMatches(SLOT, many, { query: "bulk" })).toHaveLength(LIBRARY_ROW_CAP);
  });
});
