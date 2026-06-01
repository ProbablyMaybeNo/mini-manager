/**
 * P12.16 — Universal "Assign ▾" affordance on tool result rows.
 *
 * A small button next to each tool-result swatch / row that opens
 * the existing SendToRecipeModal with just that swatch pre-loaded.
 * V1 wires it into the Match results row; other tool surfaces
 * (Wheel harmony swatches, Layering ramp steps, Eyedropper pins)
 * pull it in via the same component.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("SwatchAssignButton component surface", () => {
  const src = read("src/components/tools/SwatchAssignButton.tsx");

  test("wraps the existing SendToRecipeModal", () => {
    expect(src).toContain("SendToRecipeModal");
  });

  test("trigger uses variant='primary' (cyan, navigate-to semantic)", () => {
    expect(src).toMatch(/variant="primary"/);
  });

  test("default label is 'Assign ▾'", () => {
    expect(src).toContain("Assign ▾");
  });

  test("default size is 'sm' (sits next to a swatch)", () => {
    expect(src).toContain('size?: "sm" | "md"');
    expect(src).toContain('size = "sm"');
  });

  test("hands a single-swatch array to the modal", () => {
    // swatches={[swatch]} — the per-swatch invariant.
    expect(src).toContain("swatches={[swatch]}");
  });

  test("passes the toolId through unchanged", () => {
    expect(src).toContain("toolId={toolId}");
  });
});

describe("MatchResultsRow integrates the Assign button", () => {
  const src = read("src/components/tools/match/MatchResultsRow.tsx");

  test("imports SwatchAssignButton", () => {
    expect(src).toContain("SwatchAssignButton");
  });

  test("renders it only when showAssign prop is true", () => {
    expect(src).toContain("showAssign?: boolean");
    expect(src).toContain("{showAssign ? (");
  });

  test("passes paint hex + id + name through to the button", () => {
    // Sanity: the swatch carries id-as-sourcePaintId so a sub-2 ΔE
    // match can be saved as a paint reference instead of a custom hex.
    expect(src).toContain("hex: paint.hex");
    expect(src).toContain("sourcePaintId: paint.id");
    expect(src).toContain('toolId="match"');
  });
});

describe("MatchClient opts in via showAssign", () => {
  const src = read("src/components/tools/match/MatchClient.tsx");

  test("renders MatchResultsRow with showAssign", () => {
    expect(src).toMatch(/MatchResultsRow[\s\S]{0,200}showAssign/);
  });
});
