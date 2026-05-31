import { describe, expect, test } from "vitest";
import { parseStoredViewMode } from "@/lib/hooks/useLibraryViewMode";

describe("parseStoredViewMode", () => {
  test("returns 'list' when storage is empty", () => {
    expect(parseStoredViewMode(null)).toBe("list");
    expect(parseStoredViewMode(undefined)).toBe("list");
  });

  test("returns 'grid' when stored value is 'grid'", () => {
    expect(parseStoredViewMode("grid")).toBe("grid");
  });

  test("returns 'list' when stored value is 'list'", () => {
    expect(parseStoredViewMode("list")).toBe("list");
  });

  test("falls back to 'list' for garbage values", () => {
    expect(parseStoredViewMode("compact")).toBe("list");
    expect(parseStoredViewMode("")).toBe("list");
    expect(parseStoredViewMode("LIST")).toBe("list");
    expect(parseStoredViewMode("null")).toBe("list");
  });
});
