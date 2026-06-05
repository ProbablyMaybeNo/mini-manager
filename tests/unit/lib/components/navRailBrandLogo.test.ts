/**
 * UI-CHROME — NavRail top-left brand mark is the sign-in Logo.
 *
 * The desktop sidebar's top-left "MINI MANAGER" text wordmark is replaced
 * by the same engraved CRT brand logo used on the /sign-in screen
 * (`@/components/ui/Logo`, which renders `/brand/logo.png`). It stays a
 * link to /projects (home) and keeps an accessible name so the decorative
 * image needs no alt of its own.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("NavRail — UI-CHROME brand logo replaces the text wordmark", () => {
  const src = read("src/components/NavRail.tsx");

  test("imports the shared sign-in Logo primitive", () => {
    expect(src).toContain('import { Logo } from "@/components/ui/Logo"');
  });

  test("renders the Logo, not the MINI MANAGER text wordmark", () => {
    expect(src).toContain("<Logo");
    expect(src).not.toContain("MINI MANAGER");
  });

  test("the brand link still points home (/projects)", () => {
    expect(src).toMatch(/<Link[\s\S]{0,120}href="\/projects"/);
  });

  test("the brand link carries the accessible name", () => {
    expect(src).toMatch(/aria-label="Mini Manager"/);
  });
});
