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
    // The block after the media query should set transition: none on caret-row.
    const reducedMotionIdx = css.lastIndexOf("prefers-reduced-motion: reduce");
    const caretNoneIdx = css.indexOf(".caret-row::before", reducedMotionIdx);
    expect(caretNoneIdx).toBeGreaterThan(reducedMotionIdx);
  });
});
