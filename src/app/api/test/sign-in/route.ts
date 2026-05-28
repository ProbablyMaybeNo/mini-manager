import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";

/**
 * Test-only sign-in shortcut. Bypasses the magic-link flow so Playwright
 * E2E tests can mint a session in one POST. The route only responds when
 * `ALLOW_TEST_AUTH=1` is set in the environment — production builds with
 * the env unset return 404, so this isn't a back-door.
 *
 * Body: { email: string }
 * Response: { ok: true, userId } + Set-Cookie: authjs.session-token=...
 *
 * Used by tests/e2e/_helpers/auth.ts. See app/docs/TESTING.md §3.
 */
export async function POST(req: Request) {
  if (process.env.ALLOW_TEST_AUTH !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: { email?: unknown };
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
  } else {
    userId = nanoid(16);
    await db.insert(users).values({ id: userId, email, name: email });
  }

  const sessionToken = nanoid(32);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });

  const res = NextResponse.json({ ok: true, userId });
  res.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}
