/**
 * UX-004 — monospace readability floor.
 *
 * IBM Plex Mono reads ~15% smaller than sans at the same px, so the dense
 * 11px/13px chrome sat below the legibility floor the brief insists on.
 * The constrained, rem-based type ladder must keep every step distinct
 * while clearing the new floors:
 *   --text-2xs ≥ 12px (micro-labels / tech-ticks / pills),
 *   --text-xs  ≥ 14px (table cells / secondary body),
 *   --text-sm  ≥ 15px (minimum body),
 *   --text-base = 16px (anchor).
 * Tokens stay in rem so browser zoom keeps working.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const css = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/globals.css"),
  "utf-8",
);

function remToken(name: string): number {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)rem`));
  expect(m, `--${name} must be defined in rem`).not.toBeNull();
  return Number(m![1]) * 16; // 16px rem anchor (html font-size: 16px)
}

describe("UX-004 — mono readability floor (rem-based, constrained ladder)", () => {
  test("micro-label floor: --text-2xs ≥ 12px", () => {
    expect(remToken("text-2xs")).toBeGreaterThanOrEqual(12);
  });
  test("table / secondary body floor: --text-xs ≥ 14px", () => {
    expect(remToken("text-xs")).toBeGreaterThanOrEqual(14);
  });
  test("minimum body floor: --text-sm ≥ 15px", () => {
    expect(remToken("text-sm")).toBeGreaterThanOrEqual(15);
  });
  test("base anchor unchanged at 16px", () => {
    expect(remToken("text-base")).toBe(16);
  });

  test("the ladder stays strictly ascending (a hierarchy, not one blur)", () => {
    const ladder = [
      "text-2xs",
      "text-xs",
      "text-sm",
      "text-base",
      "text-lg",
      "text-xl",
      "text-2xl",
      "text-3xl",
    ].map(remToken);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]!);
    }
  });

  test("html keeps the 16px rem anchor so zoom works", () => {
    expect(css).toMatch(/html\s*\{[^}]*font-size:\s*16px/);
  });
});
