import { describe, expect, test } from "vitest";
import type { StatusPillKind } from "@/components/ui/StatusPill";

/**
 * StatusPill kind contract — locks the 7-active + 1-deprecated surface
 * area added in P11.10. `purple` is the canonical 5th-palette slot;
 * `magenta` remains as a deprecated alias so existing markup keeps
 * rendering during the Phase 11 sweep but new code should use `purple`.
 */
const ACTIVE_KINDS: StatusPillKind[] = [
  "ok",
  "warning",
  "wishlist",
  "danger",
  "info",
  "neutral",
  "purple",
];

describe("StatusPill kinds", () => {
  test("purple is exposed as the 5th-palette accent (P11.10)", () => {
    const kind: StatusPillKind = "purple";
    expect(kind).toBe("purple");
  });

  test("magenta is still accepted as a deprecated alias (back-compat)", () => {
    const kind: StatusPillKind = "magenta";
    expect(kind).toBe("magenta");
  });

  test("all seven canonical kinds compile against the type", () => {
    // Compile-time check — if any kind drops out of the union this fails
    // at typecheck before reaching the assertion.
    for (const k of ACTIVE_KINDS) {
      expect(k).toBeTruthy();
    }
  });
});
