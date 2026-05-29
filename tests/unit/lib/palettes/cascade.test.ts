import { describe, expect, test } from "vitest";
import {
  normaliseHex,
  validatePaletteColors,
} from "@/lib/palettes/cascade";

describe("normaliseHex", () => {
  test("upper-cases a 6-digit hex and adds the leading #", () => {
    expect(normaliseHex("5a9dd8")).toBe("#5A9DD8");
    expect(normaliseHex("#5a9dd8")).toBe("#5A9DD8");
  });

  test("expands 3-digit shorthand", () => {
    expect(normaliseHex("#abc")).toBe("#AABBCC");
    expect(normaliseHex("f00")).toBe("#FF0000");
  });

  test("trims surrounding whitespace", () => {
    expect(normaliseHex("  #0e4a8a  ")).toBe("#0E4A8A");
  });

  test("returns null for malformed or non-string input", () => {
    expect(normaliseHex("nope")).toBeNull();
    expect(normaliseHex("#12g456")).toBeNull();
    expect(normaliseHex("#1234")).toBeNull();
    expect(normaliseHex(42)).toBeNull();
    expect(normaliseHex(null)).toBeNull();
  });
});

describe("validatePaletteColors", () => {
  test("normalises a list of hexes and null-fills paintIds", () => {
    const res = validatePaletteColors(["#0e4a8a", "33ff66"], null);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.colorHexes).toEqual(["#0E4A8A", "#33FF66"]);
    expect(res.paintIds).toEqual([null, null]);
  });

  test("keeps supplied paintIds aligned, blanking empty strings", () => {
    const res = validatePaletteColors(
      ["#000000", "#ffffff"],
      ["citadel-abaddon-black", ""],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.paintIds).toEqual(["citadel-abaddon-black", null]);
  });

  test("rejects an empty palette", () => {
    const res = validatePaletteColors([], null);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/at least one colour/);
  });

  test("rejects a palette beyond the 32-colour cap", () => {
    const many = Array.from({ length: 33 }, () => "#000000");
    const res = validatePaletteColors(many, null);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/too many colours/);
  });

  test("rejects any malformed hex in the list", () => {
    const res = validatePaletteColors(["#0e4a8a", "garbage"], null);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Invalid hex value/);
  });

  test("rejects a paintIds array whose length mismatches", () => {
    const res = validatePaletteColors(["#000000", "#ffffff"], ["only-one"]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/length must match/);
  });
});
