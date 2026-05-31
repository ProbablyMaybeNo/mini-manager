import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/db/schema";

// The adapter is generic over SQL flavour but TS can't narrow the
// LibSQLDatabase type through the union, so we explicitly bind the
// generic to a SQLite-flavoured db. Identical at runtime; just a typing
// nudge so the schema overload picks SQLite-shaped tables.
type SqliteDb = BaseSQLiteDatabase<"sync" | "async", unknown, Record<string, never>>;

/**
 * Auth config for Mini Manager.
 *
 * Phase 9 — Credentials (username + password) is the sole sign-in path,
 * but it does NOT flow through NextAuth's Credentials provider. The
 * sign-up + sign-in server actions in `src/lib/auth/signUp.ts` mint
 * session rows directly via `createSession()` in
 * `src/lib/auth/session.ts`. This:
 *
 *   1. Keeps the database session strategy + Drizzle adapter intact,
 *      so `auth()` lookups continue to work via the `session` table.
 *   2. Side-steps Auth.js v5's "Credentials provider requires JWT
 *      session strategy" assertion. We can't register the Credentials
 *      provider AND keep database sessions in the same config —
 *      `assertConfig` rejects that combo. Since the first-party UI
 *      doesn't route through `signIn()` anyway, dropping the provider
 *      registration is lossless.
 *
 * The Resend transport survives only as a one-shot mailer for recovery-
 * email verification and password reset (see
 * `src/lib/auth/sendVerificationEmail.ts`); both flows live entirely
 * outside NextAuth and just borrow the `verificationTokens` table.
 *
 * `providers: []` is intentional. If OAuth lands later, register the
 * provider here and the existing adapter wiring picks it up.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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
  providers: [],
});
