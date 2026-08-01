/**
 * Admin lookup: find an account by email and print what you need to act on it.
 *
 * Exists because there is no email lookup anywhere in the app — `/admin/comp`
 * searches by USERNAME and `listCompedUsers` only lists already-comped
 * accounts, so "does <email> have an account, and what's their username?"
 * had no answer short of querying the database.
 *
 * Read-only. Prints no secrets (never selects passwordHash or token columns).
 *
 * Usage — against PRODUCTION, supplying the Turso creds inline so they are
 * never written to a file:
 *
 *   DATABASE_URL="libsql://<db>.turso.io" \
 *   DATABASE_AUTH_TOKEN="<token>" \
 *   npx tsx scripts/lookup-user.mts someone@example.com
 *
 * Against the local dev DB, just:
 *   npx tsx scripts/lookup-user.mts someone@example.com
 */
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq, or } from "drizzle-orm";
import * as schema from "../src/db/schema";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("usage: npx tsx scripts/lookup-user.mts <email>");
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? "file:./data/local.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client, { schema });

console.log(`[lookup] ${url.startsWith("file:") ? "LOCAL" : "REMOTE"} — searching for ${email}`);

// Match on either column: `email` is the signup address the admin allowlist and
// verification key off; `recoveryEmail` is separately settable, so an account
// can be reachable at an address that isn't its primary.
const rows = await db
  .select({
    id: schema.users.id,
    username: schema.users.username,
    email: schema.users.email,
    recoveryEmail: schema.users.recoveryEmail,
    emailVerified: schema.users.emailVerified,
    plan: schema.users.plan,
    comp: schema.users.freeForeverGrantedAt,
  })
  .from(schema.users)
  .where(
    or(
      eq(schema.users.email, email),
      eq(schema.users.email, email.toLowerCase()),
      eq(schema.users.recoveryEmail, email),
      eq(schema.users.recoveryEmail, email.toLowerCase()),
    ),
  );

if (rows.length === 0) {
  console.log("[lookup] NO ACCOUNT found for that address.");
  console.log("         (Emails are stored as entered — if they signed up with");
  console.log("          different capitalisation this still catches it, but a");
  console.log("          typo'd address would not.)");
} else {
  for (const r of rows) {
    console.log("");
    console.log("  username :", r.username ?? "(none)");
    console.log("  email    :", r.email, r.email === email ? "" : "(matched on recovery email)");
    console.log("  verified :", r.emailVerified ? `yes — ${r.emailVerified.toISOString()}` : "NO");
    console.log("  plan     :", r.plan);
    console.log("  comped   :", r.comp ? `yes — ${r.comp.toISOString()}` : "no");
    // NOTE: the users table has no createdAt column, so there is no signup
    // date to report here.
    console.log("  user id  :", r.id);
  }
  console.log("");
  console.log("[lookup] Grant comp at /admin/comp using the USERNAME above.");
}

client.close();
