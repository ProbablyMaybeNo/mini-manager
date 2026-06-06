/**
 * UX-001 — themed not-found + global-error boundaries.
 *
 * The Next.js default boundaries paint a WHITE page (text ~1.04:1 on
 * white) inside our pure-black terminal app. These source-sentinel
 * assertions pin the themed replacements so a refactor can't silently
 * reintroduce the white-flash default:
 *   - a root `not-found.tsx` exists, renders the terminal shell colours,
 *     a cyan 404 lockup, and the RETURN TO DASHBOARD link.
 *   - a `global-error.tsx` exists, renders its own <html>/<body> with a
 *     near-black (#0A0A0A) inline background (so there is no white flash
 *     even before the stylesheet applies) and a way back.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const appDir = path.resolve(__dirname, "../../../../src/app");
const notFound = fs.readFileSync(path.join(appDir, "not-found.tsx"), "utf-8");
const globalError = fs.readFileSync(
  path.join(appDir, "global-error.tsx"),
  "utf-8",
);

describe("UX-001 — themed not-found boundary", () => {
  test("renders a cyan 404 lockup", () => {
    expect(notFound).toMatch(/404/);
    expect(notFound).toMatch(/--color-cyan/);
  });

  test("offers RETURN TO DASHBOARD to /projects", () => {
    expect(notFound).toMatch(/RETURN TO DASHBOARD/);
    expect(notFound).toMatch(/href="\/projects"/);
  });

  test("never uses a white/light background", () => {
    expect(notFound).not.toMatch(/bg-white|#fff|#ffffff/i);
  });

  test("keeps an accessible h1 for screen readers", () => {
    expect(notFound).toMatch(/<h1[^>]*sr-only/);
  });
});

describe("UX-001 — themed global-error boundary", () => {
  test("renders its own html/body (replaces the root layout)", () => {
    expect(globalError).toMatch(/<html/);
    expect(globalError).toMatch(/<body/);
  });

  test("paints a near-black inline background to kill the white flash", () => {
    // The inline #0A0A0A is the worst-case guard before globals.css applies.
    expect(globalError).toMatch(/#0A0A0A/i);
    expect(globalError).not.toMatch(/background:\s*(#fff|#ffffff|white)\b/i);
  });

  test("exposes a reset action and a route back to the dashboard", () => {
    expect(globalError).toMatch(/reset\(\)/);
    expect(globalError).toMatch(/href="\/projects"/);
  });
});
