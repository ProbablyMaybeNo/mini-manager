/**
 * R7-009 — Mobile avatar pill is a navigable Link to /user.
 *
 * The Round-7 auditor flagged that "mobile users have no path to
 * /user". On re-verification the avatar pill IS already wrapped in a
 * `<Link href="/user">` (landed in P8.6). This sentinel pins the wiring
 * so a future regression can't silently strip the Link and recreate
 * the navigation dead-end.
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

describe("MobileHeader — R7-009 user avatar links to /user", () => {
  const src = read("src/components/MobileHeader.tsx");

  test("imports Next.js Link", () => {
    expect(src).toContain('import Link from "next/link";');
  });

  test("avatar pill is wrapped in <Link href=\"/user\">", () => {
    expect(src).toMatch(/<Link[\s\S]{0,60}href="\/user"/);
  });

  test("the avatar Link carries an accessible label", () => {
    expect(src).toContain('aria-label="User"');
  });

  test("active state highlights when pathname starts with /user", () => {
    expect(src).toContain('pathname.startsWith("/user")');
    expect(src).toContain('aria-current={userActive ? "page" : undefined}');
  });

  test("avatar meets the tap-target floor", () => {
    expect(src).toContain("tap-target");
  });

  test("brand logo also links to /projects — secondary nav path", () => {
    // Belt + braces. The brand link going to /projects is the other
    // mobile escape hatch from any deep page. UI-CHROME: the "MINI
    // MANAGER" wordmark was replaced by the sign-in Logo, but the Link
    // (and its /projects target) survives.
    expect(src).toMatch(/<Link[\s\S]{0,90}href="\/projects"/);
  });

  test("UI-CHROME — brand mark is the sign-in Logo, not a text wordmark", () => {
    expect(src).toContain('import { Logo } from "@/components/ui/Logo"');
    expect(src).toContain("<Logo");
    expect(src).not.toContain("MINI MANAGER");
    // The brand Link names itself for AT since the Logo is decorative.
    expect(src).toMatch(/aria-label="Mini Manager"/);
  });
});
