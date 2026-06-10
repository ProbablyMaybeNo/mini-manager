import { describe, expect, test } from "vitest";
import { parseStoredViewMode } from "@/lib/hooks/useLibraryViewMode";

describe("parseStoredViewMode", () => {
  // FIGMA-REBUILD — the Library opens on the swatch-wall GRID by default
  // (the Figma frame leads with it); a stored choice still wins.
  test("returns 'grid' when storage is empty", () => {
    expect(parseStoredViewMode(null)).toBe("grid");
    expect(parseStoredViewMode(undefined)).toBe("grid");
  });

  test("returns 'grid' when stored value is 'grid'", () => {
    expect(parseStoredViewMode("grid")).toBe("grid");
  });

  test("returns 'list' when stored value is 'list'", () => {
    expect(parseStoredViewMode("list")).toBe("list");
  });

  test("falls back to the 'grid' default for garbage values", () => {
    expect(parseStoredViewMode("compact")).toBe("grid");
    expect(parseStoredViewMode("")).toBe("grid");
    expect(parseStoredViewMode("LIST")).toBe("grid");
    expect(parseStoredViewMode("null")).toBe("grid");
  });
});
