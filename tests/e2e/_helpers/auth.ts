import type { Page } from "@playwright/test";

/**
 * Mint a session for the given test user via the test-only sign-in
 * route. The route is gated by `ALLOW_TEST_AUTH=1` in the env — make
 * sure the dev server is launched with that set, or rely on
 * playwright.config.ts's webServer block to set it for you.
 *
 * Returns the userId so the test can correlate created rows.
 */
export async function signInAs(
  page: Page,
  email: string,
): Promise<{ userId: string }> {
  const res = await page.request.post("/api/test/sign-in", {
    data: { email },
  });
  if (!res.ok()) {
    throw new Error(
      `signInAs failed (${res.status()}): ${await res.text()} — is ALLOW_TEST_AUTH=1 set on the dev server?`,
    );
  }
  const body = (await res.json()) as { userId: string };
  return { userId: body.userId };
}

/**
 * Convenience: makes a fresh unique email for a test so runs don't
 * collide. Pair with signInAs.
 */
export function freshTestEmail(prefix = "qa"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}
