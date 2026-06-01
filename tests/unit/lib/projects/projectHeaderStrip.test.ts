/**
 * P12.8 — Project detail header strip.
 *
 * Title + stat row + full-width progress bar. Replaces the prior
 * ad-hoc header on /projects/<id>. Ross's brief locks the layout:
 *   <h1 cyan> · type chip · faction · model count · status pill ·
 *     + Add unit (green CTA, right-aligned)
 *   <ProgressBar stretch height=14 percent={percent}> with the
 *     percent overlay centered.
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

describe("ProjectHeaderStrip component surface", () => {
  const src = read("src/components/ProjectHeaderStrip.tsx");

  test("title renders in cyan with the locked glow", () => {
    expect(src).toContain("text-[var(--color-cyan)]");
    expect(src).toMatch(/textShadow:\s*\n?\s*"0 0 12px/);
  });

  test("type chip uses the existing TYPE_CHIP palette", () => {
    expect(src).toContain("type-chip-cyan");
    expect(src).toContain("type-chip-amber");
    expect(src).toContain("type-chip-purple");
    expect(src).toContain("type-chip-green");
  });

  test("status pill mapping covers all 8 DisplayStatus values", () => {
    for (const s of [
      "WISHLIST",
      "PURCHASED",
      "BUILDING",
      "PRIMING",
      "PAINTING",
      "BASING",
      "COMPLETE",
      "SHELVED",
    ]) {
      expect(src).toContain(s);
    }
  });

  test("the + Add CTA uses variant='success' (locked button discipline)", () => {
    expect(src).toMatch(/variant="success"/);
  });

  test("the addChildCtaLabel switches label by project type", () => {
    expect(src).toContain("+ Add unit");
    expect(src).toContain("+ Add model");
    expect(src).toContain("+ Add terrain");
  });

  test("the full-width progress bar uses stretch + height={14}", () => {
    expect(src).toContain("stretch");
    expect(src).toContain("height={14}");
  });

  test("the percent overlay sits absolutely centered above the bar", () => {
    expect(src).toContain("absolute inset-0 flex items-center justify-center");
    expect(src).toContain("{percent}%");
  });
});

describe("ProgressBar — stretch + height props (P12.8)", () => {
  const src = read("src/components/ProgressBar.tsx");

  test("ProgressBar accepts a `stretch` prop for full-width layout", () => {
    expect(src).toContain("stretch?: boolean");
  });

  test("ProgressBar accepts a `height` prop", () => {
    expect(src).toContain("height?: number");
  });

  test("stretch mode renders block + w-full + no inline width", () => {
    expect(src).toContain('"block w-full"');
    expect(src).toContain('{ height: `${height}px` }');
  });
});

describe("Project detail page wires the new header strip in", () => {
  const src = read("src/app/projects/[id]/page.tsx");

  test("imports ProjectHeaderStrip", () => {
    expect(src).toContain("ProjectHeaderStrip");
  });

  test("the old inline <h1> + StatusPill header block is gone", () => {
    // The prior header had `{status} · {percent}%` in a StatusPill;
    // P12.8 moves that into the component, so the page no longer
    // references HEADER_STATUS_PILL.
    expect(src).not.toContain("HEADER_STATUS_PILL");
  });

  test("page passes showAddChild based on project.type (container vs leaf)", () => {
    expect(src).toContain("showAddChild=");
    expect(src).toContain('project.type === "Army"');
  });
});
