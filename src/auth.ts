import NextAuth from "next-auth";
import type { EmailConfig } from "next-auth/providers/email";
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
 * Phase 1.3: magic-link email only. OAuth (Google / GitHub) is plumbed
 * via Auth.js env-var inference (`AUTH_GOOGLE_ID` etc.) but no provider
 * is registered yet — we add the imports once Ross supplies credentials.
 *
 * Magic-link transport:
 *   - If `AUTH_RESEND_KEY` is set, Resend sends the email.
 *   - Otherwise the verification URL is printed to the dev console via
 *     a custom `sendVerificationRequest`. That's the v1 dev experience;
 *     copy-paste the URL into the browser to sign in.
 *
 * The Drizzle adapter is wired explicitly to our schema's NextAuth
 * tables (defined in `src/db/schema.ts` from P1.2) so it doesn't try
 * to auto-define its own.
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
    verifyRequest: "/sign-in?sent=1",
  },
  providers: [magicLinkProvider()],
});

/**
 * Inline email provider — bypasses the Resend factory's apiKey checks.
 *
 * When `AUTH_RESEND_KEY` is set we POST directly to the Resend REST API
 * (no extra npm dep). When it isn't we bracket-frame the verification
 * URL to the dev server console — copy + paste it into the browser to
 * finish signing in.
 */
function magicLinkProvider(): EmailConfig {
  return {
    id: "resend",
    type: "email",
    name: "Magic Link",
    server: "",
    maxAge: 24 * 60 * 60,
    from: process.env.AUTH_EMAIL_FROM ?? "Mini Manager <no-reply@localhost>",
    options: {},
    async sendVerificationRequest({ identifier, url }) {
      if (process.env.AUTH_RESEND_KEY) {
        const host = new URL(url).host;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:
              process.env.AUTH_EMAIL_FROM ??
              "Mini Manager <no-reply@authjs.dev>",
            to: identifier,
            subject: `Sign in to ${host}`,
            text: `Sign in to ${host}\n\n${url}\n\nIf you didn't request this, ignore this email.`,
            html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">${url}</a></p><p style="color:#888">If you didn't request this, ignore this email.</p>`,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend error (${res.status}): ${body}`);
        }
        return;
      }

      console.log(
        [
          "",
          "┌─ MINI MANAGER · MAGIC LINK ─────────────────────────",
          `│ to:  ${identifier}`,
          `│ url: ${url}`,
          "└─────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    },
  };
}
