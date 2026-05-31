import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { validateUsername } from "@/lib/auth/validation";

// The adapter is generic over SQL flavour but TS can't narrow the
// LibSQLDatabase type through the union, so we explicitly bind the
// generic to a SQLite-flavoured db. Identical at runtime; just a typing
// nudge so the schema overload picks SQLite-shaped tables.
type SqliteDb = BaseSQLiteDatabase<"sync" | "async", unknown, Record<string, never>>;

/**
 * Auth config for Mini Manager.
 *
 * Phase 9 — Credentials (username + password) is the sole sign-in path.
 * The Resend transport survives as a one-shot mailer for recovery-email
 * verification and password reset (see `src/lib/auth/sendVerificationEmail.ts`
 * landing in P9.5 / P9.6) but is no longer wired into NextAuth.
 *
 * Session strategy stays `database` — the adapter session tables back
 * `auth()` lookups. The sign-up + sign-in server actions create session
 * rows directly via `createSession()` in `src/lib/auth/session.ts`
 * (mirroring the long-standing test-auth route in
 * `src/app/api/test/sign-in/route.ts`); this side-steps Auth.js v5's
 * Credentials-prefers-JWT default and keeps every session lookup going
 * through one DB-backed code path.
 *
 * The Credentials provider is still registered so that the bundled
 * `/api/auth/...` routes + `signIn("credentials", ...)` helpers from
 * future server code have a working `authorize` to delegate to. Today's
 * first-party UI does not call `signIn` directly.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's generic schema typing is stricter than ours (it
  // doesn't know about our extra `username` column on users, etc.),
  // but the runtime contract is identical — same table + column names.
  // We bind the SQL flavour explicitly so the SQLite schema overload
  // is picked, then cast the schema object through `unknown` for the
  // remaining structural-shape mismatch.
  adapter: DrizzleAdapter<SqliteDb>(
    db as unknown as SqliteDb,
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    } as unknown as Parameters<typeof DrizzleAdapter<SqliteDb>>[1],
  ),
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const username =
          typeof creds?.username === "string" ? creds.username : "";
        const password =
          typeof creds?.password === "string" ? creds.password : "";
        const u = validateUsername(username);
        if (!u.ok || !password) return null;

        const row = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.username, u.normalized))
          .limit(1);

        const user = row[0];
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return {
          id: user.id,
          name: user.username ?? null,
          email: user.email ?? null,
        };
      },
    }),
  ],
});
