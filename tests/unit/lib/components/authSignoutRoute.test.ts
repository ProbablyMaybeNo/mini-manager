/**
 * UX-913 — `/auth/signout` no longer 404s.
 *
 * Direct nav to `/auth/signout` (a leftover NextAuth-style URL that
 * users still land on via bookmarks or browser autocomplete) used to
 * return Next.js's default 404 page because no route existed at that
 * path. The fix: a real route handler at `src/app/auth/signout/route.ts`
 * that tears down the session and bounces to `/sign-in`.
 *
 * This file-level scan locks the contract so the route file can't
 * silently disappear in a future refactor.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTE_PATH = "src/app/auth/signout/route.ts";

function readRoute(): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", ROUTE_PATH),
    "utf-8",
  );
}

describe("/auth/signout route handler (UX-913)", () => {
  test("route handler file exists", () => {
    const fullPath = path.resolve(__dirname, "../../../../", ROUTE_PATH);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  test("exports both GET and POST handlers", () => {
    const src = readRoute();
    expect(src).toMatch(/export\s+async\s+function\s+GET\b/);
    expect(src).toMatch(/export\s+async\s+function\s+POST\b/);
  });

  test("both handlers tear down the current session", () => {
    const src = readRoute();
    const matches = src.match(/destroyCurrentSession\(\)/g) ?? [];
    // Once in GET, once in POST.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test("both handlers redirect to /sign-in", () => {
    const src = readRoute();
    const matches = src.match(/redirect\("\/sign-in"\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
