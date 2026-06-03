/**
 * Marketing landing page at `/` (src/app/page.tsx). Source-level sentinels —
 * the page is an async server component (auth + redirect), brittle to render
 * in node, so we pin the contract: signed-in users skip to the app, signed-out
 * users get the pitch with the right CTAs, and it stays on-aesthetic.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const src = fs.readFileSync(
  path.resolve(__dirname, "../../../../src/app/page.tsx"),
  "utf-8",
);

describe("/ landing page", () => {
  test("signed-in visitors are redirected to the app", () => {
    expect(src).toContain("await auth()");
    expect(src).toMatch(/if \(session\?\.user\?\.id\) redirect\("\/projects"\)/);
  });

  test("primary CTA starts a free account (success variant → /sign-up)", () => {
    expect(src).toMatch(/href="\/sign-up"[\s\S]*?variant="success"/);
  });

  test("links to pricing + sign-in", () => {
    expect(src).toContain('href="/pricing"');
    expect(src).toContain('href="/sign-in"');
  });

  test("uses the Button primitive (no hand-rolled CTAs)", () => {
    expect(src).toContain('from "@/components/ui/Button"');
  });

  test("exports page-specific SEO metadata", () => {
    expect(src).toContain("export const metadata");
  });

  test("no raw hex colours in the markup (tokens only)", () => {
    // Strip comments, then assert no #rgb/#rrggbb literals leak into JSX.
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
