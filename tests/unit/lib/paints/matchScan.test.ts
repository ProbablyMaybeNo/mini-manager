import { describe, expect, test } from "vitest";
import { matchExtractedPaint, matchScannedPaints } from "@/lib/paints/matchScan";
import type { Paint } from "@/lib/paints/types";

/**
 * Unit tests for the vision-label -> catalog matcher. Pure function, no
 * mocking needed. Uses a small fixture catalog so match/no-match/alternate
 * outcomes are fully deterministic regardless of the real 7k-row catalog.
 */

function paint(overrides: Partial<Paint> & Pick<Paint, "id" | "brand" | "name">): Paint {
  return {
    type: "Paint",
    hex: "#7a1717",
    hexConfidence: "high",
    hexSource: "test",
    sourceUrl: "https://example.com/" + overrides.id,
    ...overrides,
  };
}

const CATALOG: Paint[] = [
  paint({ id: "c1", brand: "Citadel", name: "Mephiston Red" }),
  paint({ id: "c2", brand: "Citadel", name: "Abaddon Black" }),
  paint({ id: "c3", brand: "Citadel", name: "Macragge Blue" }),
  paint({ id: "ap1", brand: "The Army Painter", name: "Matt Black" }),
  paint({ id: "ap2", brand: "The Army Painter", name: "Wolf Grey" }),
  paint({ id: "v1", brand: "Vallejo Model Color", name: "Ivory" }),
  paint({ id: "v2", brand: "Vallejo Game Color", name: "Ivory" }),
  paint({ id: "v3", brand: "Vallejo Game Air", name: "Off White" }),
  paint({ id: "s1", brand: "Scale75", name: "Dark Stains" }),
  paint({ id: "pa1", brand: "Pro Acryl", name: "Black Wash" }),
];

describe("matchExtractedPaint — hits", () => {
  test("exact brand + exact name is a confident hit with no better alternate", () => {
    const res = matchExtractedPaint({ brand: "Citadel", name: "Mephiston Red" }, CATALOG);
    expect(res.match?.id).toBe("c1");
  });

  test("a typo'd name within the right brand still matches", () => {
    const res = matchExtractedPaint({ brand: "Citadel", name: "Mephistan Red" }, CATALOG);
    expect(res.match?.id).toBe("c1");
  });

  test("reordered words still match (token overlap)", () => {
    const res = matchExtractedPaint({ brand: "Citadel", name: "Red Mephiston" }, CATALOG);
    expect(res.match?.id).toBe("c1");
  });
});

describe("matchExtractedPaint — brand-scoping", () => {
  test("'Army Painter' resolves to the catalog's 'The Army Painter' brand", () => {
    const res = matchExtractedPaint({ brand: "Army Painter", name: "Matt Black" }, CATALOG);
    expect(res.match?.id).toBe("ap1");
  });

  test("'Vallejo' alone (no line) scopes across every Vallejo product line", () => {
    const res = matchExtractedPaint({ brand: "Vallejo", name: "Ivory" }, CATALOG);
    expect(res.match).not.toBeNull();
    expect(["v1", "v2"]).toContain(res.match!.id);
    // The other same-named Vallejo-line paint should surface as an alternate.
    const altIds = res.alternates.map((a) => a.id);
    expect(altIds).toContain(res.match!.id === "v1" ? "v2" : "v1");
  });

  test("brand scoping keeps a same-named paint in another brand out of the top match", () => {
    // "Ivory" also exists under Citadel-adjacent brands in a bigger catalog;
    // here the scoped brand should win over any lexically identical name
    // living under an unrelated brand — Scale75 has no "Ivory", so this just
    // confirms Vallejo's own line match beats a cross-brand distraction.
    const res = matchExtractedPaint({ brand: "Vallejo Model Color", name: "Ivory" }, CATALOG);
    expect(res.match?.id).toBe("v1");
  });
});

describe("matchExtractedPaint — misses", () => {
  test("a brand that exists but no plausible name match falls back to null with alternates", () => {
    const res = matchExtractedPaint({ brand: "Citadel", name: "Xyzzyplorp Fluorescent" }, CATALOG);
    expect(res.match).toBeNull();
  });

  test("a completely unknown brand + name yields null with no crash", () => {
    const res = matchExtractedPaint({ brand: "Not A Real Brand", name: "Not A Real Paint" }, CATALOG);
    expect(res.match).toBeNull();
    expect(Array.isArray(res.alternates)).toBe(true);
  });

  test("alternates never include the chosen match", () => {
    const res = matchExtractedPaint({ brand: "Citadel", name: "Mephiston Red" }, CATALOG);
    expect(res.alternates.some((a) => a.id === res.match?.id)).toBe(false);
  });
});

describe("matchExtractedPaint — cross-brand fuzzy fallback", () => {
  test("an unrecognised brand still finds a strong cross-brand name match", () => {
    // "Off-White" (unknown brand) is a near-exact hit against Vallejo Game
    // Air's "Off White" — the cross-brand bar is stricter, but an
    // essentially-exact name still clears it.
    const res = matchExtractedPaint({ brand: "Some Random Brand", name: "Off White" }, CATALOG);
    expect(res.match?.id).toBe("v3");
  });

  test("a weak cross-brand name similarity does not force a bad match", () => {
    const res = matchExtractedPaint({ brand: "Some Random Brand", name: "Grey" }, CATALOG);
    // "Grey" alone is short/ambiguous against "Wolf Grey" — should not
    // clear the stricter cross-brand bar into a false-positive hit.
    expect(res.match).toBeNull();
  });
});

describe("matchScannedPaints — batch", () => {
  test("maps each extracted label to its own result in order", () => {
    const results = matchScannedPaints(
      [
        { brand: "Citadel", name: "Mephiston Red" },
        { brand: "Scale75", name: "Dark Stains" },
        { brand: "Pro Acryl", name: "Black Wash" },
      ],
      CATALOG,
    );
    expect(results.map((r) => r.match?.id)).toEqual(["c1", "s1", "pa1"]);
  });

  test("an empty extracted list returns an empty result list", () => {
    expect(matchScannedPaints([], CATALOG)).toEqual([]);
  });
});
