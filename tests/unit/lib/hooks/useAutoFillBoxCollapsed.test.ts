import { describe, expect, test } from "vitest";
import { parseStoredCollapsed } from "@/lib/hooks/useAutoFillBoxCollapsed";

describe("parseStoredCollapsed", () => {
  // Open by default: an empty / unset store means expanded (Ross's call on
  // sFAkBUvAcSiF). Only the explicit "1" sentinel keeps it collapsed.
  test("returns false (open) when storage is empty", () => {
    expect(parseStoredCollapsed(null)).toBe(false);
    expect(parseStoredCollapsed(undefined)).toBe(false);
    expect(parseStoredCollapsed("")).toBe(false);
  });

  test("returns true (collapsed) only for the '1' sentinel", () => {
    expect(parseStoredCollapsed("1")).toBe(true);
  });

  test("falls back to open for any other value", () => {
    expect(parseStoredCollapsed("0")).toBe(false);
    expect(parseStoredCollapsed("true")).toBe(false);
    expect(parseStoredCollapsed("collapsed")).toBe(false);
  });
});
