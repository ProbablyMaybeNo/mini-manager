import "server-only";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";

/**
 * Cookie name matches the NextAuth v5 default for the adapter's
 * database-session strategy. NextAuth prefixes the cookie name with
 * `__Secure-` whenever `useSecureCookies` is on (which is the default
 * in production) — and `auth()` reads from THAT prefixed name. Our
 * manual session minting has to write to the same name or the read
 * misses and we silently bounce the user back to sign-in.
 *
 * Known Auth.js v5 gotcha — root cause of UX-V3-001 (sign-up sets
 * cookie, redirect to /projects, auth() sees null, bounce to /sign-in).
 *
 * Keep in sync with `src/auth.ts` if you ever override the cookies
 * config there.
 */
const useSecureCookies = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`;

/** 30-day session lifetime — same as NextAuth's default. */
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create a fresh DB-backed session row + write the session cookie.
 * Used by the credentials sign-up + sign-in actions.
 *
 * This mirrors the manual session minting in
 * `src/app/api/test/sign-in/route.ts` — by writing the session row
 * directly we side-step the awkward Auth.js v5 Credentials-with-database
 * pathway (which by default forces JWT strategy).
 */
export async function createSession(userId: string): Promise<{
  token: string;
  expires: Date;
}> {
  const token = nanoid(32);
  const expires = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires,
  });

  return { token, expires };
}

/** Tear down the current session: delete the DB row + clear the cookie.
 *  Safe to call when no session exists. */
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) {
    await db.delete(sessions).where(eq(sessions.sessionToken, existing));
    jar.delete(SESSION_COOKIE);
  }
}
