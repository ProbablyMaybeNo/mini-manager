/**
 * P15.3 — Mobile page-by-page polish (Round 12 audit).
 *
 * Source-level regression pins for the app-wide mobile polish pass. Each
 * block locks a single finding from ux-audit/findings_v12.json so a later
 * refactor can't silently regress the fix. Follows the repo convention of
 * asserting on source text for CSS / layout sizing changes.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("UX-1201 — .btn-sm/.btn-md floor to 44px on coarse pointers", () => {
  const css = read("src/app/globals.css");

  test("a (pointer: coarse) media query raises .btn-sm to 44px", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.btn-sm\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("the same coarse-pointer block also floors .btn-md", () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.btn-md\s*\{[\s\S]*?min-height:\s*44px/,
    );
  });

  test("desktop .btn-sm stays 28px (no min-height bump outside the query)", () => {
    expect(css).toContain(".btn-sm { padding: 4px 10px; min-height: 28px;");
  });
});
