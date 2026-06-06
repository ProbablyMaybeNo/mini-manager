/**
 * P11.10 — 5-color palette token contract.
 *
 * Locks the design tokens defined in `globals.css` so the palette
 * never silently drifts. Cyan, pastel yellow, pastel red, neon green,
 * pastel purple — the five locked accents. Pastel-purple is the new
 * 5th seat (Ross's verbatim spec); the legacy `--color-magenta`
 * token must continue to resolve so existing markup keeps rendering.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const cssPath = path.resolve(__dirname, "../../../../src/app/globals.css");
const css = fs.readFileSync(cssPath, "utf-8");

describe("5-color palette tokens (P11.10)", () => {
  test("cyan token exists", () => {
    expect(css).toMatch(/--color-cyan:\s*#[0-9a-fA-F]{3,6}/);
  });

  test("pastel yellow token exists", () => {
    expect(css).toMatch(/--color-yellow:\s*#[0-9a-fA-F]{3,6}/);
  });

  test("pastel red token exists", () => {
    expect(css).toMatch(/--color-red:\s*#[0-9a-fA-F]{3,6}/);
  });

  test("neon green token exists", () => {
    expect(css).toMatch(/--color-green:\s*#[0-9a-fA-F]{3,6}/);
  });

  test("pastel purple token is defined as the 5th palette seat", () => {
    // Phase-0 terminal rebuild repointed the 5th seat to the style-guide
    // purple #9b80dc (6.51:1 on #000 — clears WCAG-AA as text + fill).
    expect(css).toMatch(/--color-purple-pastel:\s*#9b80dc/i);
  });

  test("status-purple semantic alias resolves to the pastel purple token", () => {
    expect(css).toMatch(
      /--status-purple:\s*var\(--color-purple-pastel\)/,
    );
  });

  test("magenta semantic is preserved as a back-compat alias", () => {
    // The legacy `--color-magenta` token (used by older surfaces) must
    // resolve to the new pastel-purple value so visual continuity holds.
    expect(css).toMatch(
      /--color-magenta:\s*var\(--color-purple-pastel\)/,
    );
    expect(css).toMatch(/--status-magenta:\s*var\(--status-purple\)/);
  });

  test(".pill-purple class exists for StatusPill `purple` kind", () => {
    expect(css).toMatch(/\.pill-purple\s*\{/);
  });

  test(".pill-magenta is retained for back-compat, pointing at purple", () => {
    // Same colour resolution as pill-purple so the deprecated kind
    // doesn't drift visually during the migration window.
    expect(css).toMatch(/\.pill-magenta\s*\{\s*color:\s*var\(--status-purple\)/);
  });
});
