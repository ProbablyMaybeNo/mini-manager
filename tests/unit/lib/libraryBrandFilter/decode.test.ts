/**
 * P12.19 — Pure decoder for users.library_brand_filter.
 *
 * Tolerates null / missing / malformed JSON by returning null
 * (= "no filter"). Valid string arrays come back as the array;
 * non-string items inside are skipped.
 */
import { describe, expect, test } from "vitest";
import { decodeLibraryBrandFilter } from "@/lib/libraryBrandFilter/decode";

describe("decodeLibraryBrandFilter", () => {
  test("returns null for null input", () => {
    expect(decodeLibraryBrandFilter(null)).toBeNull();
  });

  test("returns null for undefined input", () => {
    expect(decodeLibraryBrandFilter(undefined)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(decodeLibraryBrandFilter("")).toBeNull();
  });

  test("decodes a valid array of brand strings", () => {
    expect(
      decodeLibraryBrandFilter(JSON.stringify(["Citadel", "Vallejo"])),
    ).toEqual(["Citadel", "Vallejo"]);
  });

  test("decodes an empty array as []", () => {
    expect(decodeLibraryBrandFilter("[]")).toEqual([]);
  });

  test("returns null on malformed JSON", () => {
    expect(decodeLibraryBrandFilter("not json")).toBeNull();
  });

  test("returns null when the JSON is not an array", () => {
    expect(decodeLibraryBrandFilter('{"brands":["a"]}')).toBeNull();
    expect(decodeLibraryBrandFilter("42")).toBeNull();
  });

  test("filters out non-string entries from a mixed array", () => {
    expect(
      decodeLibraryBrandFilter(JSON.stringify(["Citadel", 42, null, "Vallejo"])),
    ).toEqual(["Citadel", "Vallejo"]);
  });

  test("filters out empty-string entries", () => {
    expect(
      decodeLibraryBrandFilter(JSON.stringify(["", "Citadel", ""])),
    ).toEqual(["Citadel"]);
  });
});
