/**
 * Smoke-tests for the `.caret-row` CSS utility.
 * We can't run a real CSS engine in Node — these tests verify that the
 * globals.css file contains the expected rule blocks so the utility
 * can't be accidentally deleted during sweeps.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const cssPath = path.resolve(
  __dirname,
  "../../../../src/app/globals.css",
);
const css = fs.readFileSync(cssPath, "utf-8");

describe(".caret-row CSS utility", () => {
  test("globals.css defines the .caret-row base rule", () => {
    expect(css).toContain(".caret-row {");
  });

  test("::before pseudo-element uses the cyan token", () => {
    expect(css).toContain("--color-cyan");
  });

  test("::before content is the > glyph", () => {
    // Finds  content: ">";  or  content: '>'
    expect(css).toMatch(/content:\s*["']>["']/);
  });

  test("::before is absolute-positioned (no layout shift)", () => {
    expect(css).toContain("position: absolute");
  });

  test("focus-visible activates the caret", () => {
    expect(css).toContain(".caret-row:focus-visible::before");
  });

  test("aria-current='true' activates the caret (paint row, active paint)", () => {
    expect(css).toContain('.caret-row[aria-current="true"]::before');
  });

  test("aria-pressed='true' activates the caret (selected zone)", () => {
    expect(css).toContain('.caret-row[aria-pressed="true"]::before');
  });

  test("transition is gated on prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    // A reduced-motion block sets transition: none on caret-row. Search from
    // the FIRST reduced-motion query (not the last) — globals.css has several
    // such blocks (h1 glow, glow utilities, toast, the landing boot reveal),
    // and only caret-row's needs to follow one of them.
    const reducedMotionIdx = css.indexOf("prefers-reduced-motion: reduce");
    const caretNoneIdx = css.indexOf(".caret-row::before", reducedMotionIdx);
    expect(caretNoneIdx).toBeGreaterThan(reducedMotionIdx);
  });
});
