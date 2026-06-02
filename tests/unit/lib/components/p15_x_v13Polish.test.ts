/**
 * P15.x — Round-13 mobile/touch polish (ux-audit/findings_v13.json).
 *
 * Source-level regression pins for the non-planner v13 findings. Follows
 * the repo convention of asserting on source text for CSS / layout sizing
 * changes (the surfaces are use-client and virtualised, so render-testing
 * is brittle; the source strings are the contract).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("UX-1303 — library owned/★ toggles get a 44px tap area in card layout", () => {
  const src = read("src/components/library/InventoryControls.tsx");

  test("both compact toggles carry tap-target so the flex cluster can't shrink to the glyph", () => {
    const occurrences =
      src.split(
        "tap-target inline-flex justify-center items-center font-mono text-xs w-full h-full min-h-[40px]",
      ).length - 1;
    expect(occurrences).toBe(2);
  });
});
