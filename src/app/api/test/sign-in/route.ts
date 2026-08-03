import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { testAuthEnabled } from "@/lib/auth/testAuthGate";

/**
 * Test-only sign-in shortcut. Bypasses the magic-link flow so Playwright
 * E2E tests can mint a session in one POST. The route only responds when
 * `ALLOW_TEST_AUTH=1` is set AND the runtime is not production — see
 * `@/lib/auth/testAuthGate` for why both conditions are required and which
 * is load-bearing.
 *
 * Body: { email: string }
 * Response: { ok: true, userId } + Set-Cookie: authjs.session-token=...
 *
 * **P9.7** — accounts created via this route are now "complete" (username +
 * passwordHash set) so the migration shim in `currentUserId()` does not
 * bounce them to `/finish-account`. The synthesised credentials are
 * never used; the test path mints a session directly. The username is
 * derived from the email local-part with a random suffix to keep it
 * unique across parallel test runs.
 *
 * Used by tests/e2e/_helpers/auth.ts. See app/docs/TESTING.md §3.
 */
export async function POST(req: Request) {
  if (!testAuthEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: { email?: unknown; comp?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; comp?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  // Test users are COMPED by default (Ross, 2026-07-28): every spec predates the
  // 2026-07-22 paywall and signs in with a fresh email, so `/tools/*` and the
  // recipe picker's tool tabs rendered their LOCKED state and the specs failed
  // asserting the pre-paywall world. `getPlanForUser` resolves
  // `freeForeverGrantedAt` to pro_lifetime, so this is the same mechanism as an
  // admin comp — not a paywall bypass in product code.
  //
  // Pass `{ comp: false }` to mint a NON-subscriber and assert the gate itself.
  // Nothing does yet; the trade-off of comping by default is that the paywall
  // goes untested until a spec opts out, so this hook exists to make that a
  // one-line change rather than a revert.
  const comped = body.comp !== false;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const compGrantedAt = comped ? new Date() : null;

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    // Ensure existing legacy rows are also "complete" so the migration
    // shim doesn't bounce parallel test runs to /finish-account, and reconcile
    // the comp flag so a re-used email picks up the requested tier.
    const placeholder = await hashPassword(nanoid(32));
    await db
      .update(users)
      .set({
        passwordHash: existing[0].passwordHash ?? placeholder,
        username: existing[0].username ?? synthUsername(email),
        freeForeverGrantedAt: compGrantedAt,
      })
      .where(eq(users.id, userId));
  } else {
    userId = nanoid(16);
    const placeholder = await hashPassword(nanoid(32));
    await db.insert(users).values({
      id: userId,
      email,
      name: email,
      username: synthUsername(email),
      passwordHash: placeholder,
      freeForeverGrantedAt: compGrantedAt,
    });
  }

  const sessionToken = nanoid(32);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });

  const res = NextResponse.json({ ok: true, userId });
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires,
  });
  return res;
}

/**
 * Derive a username from an email's local-part. We strip everything
 * outside `[a-z0-9_-]`, force a `t` prefix when the local-part starts
 * with a non-alphanumeric character, and append 6 random alnum chars
 * to keep it unique across parallel runs.
 */
function synthUsername(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitised = local.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const head = /^[a-z0-9]/.test(sanitised) ? sanitised : `t${sanitised}`;
  const suffix = nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, "x");
  return `${head.slice(0, 13)}${suffix}`;
}
