/**
 * Admin delete: remove an account by username, cascade included.
 *
 * The sibling of `lookup-user.mts`. Exists because the only way to delete an
 * account is `deleteAccount()` in `src/lib/actions/account.ts`, which acts on
 * the CURRENTLY SIGNED-IN user — so an abandoned test account whose password
 * nobody has cannot be removed through the app at all. `/admin/users` is
 * read-only.
 *
 * Mirrors the app's final step exactly: delete the `users` row and let the
 * schema's `onDelete: "cascade"` FKs take everything else. libSQL enables
 * `foreign_keys` by default (unlike stock SQLite, where it is OFF and the
 * cascade would silently no-op), so this really does clean up.
 *
 * DRY RUN BY DEFAULT. It prints what it would remove and exits. Pass `--yes`
 * to actually delete.
 *
 * Not covered, deliberately — both are no-ops for a throwaway test account,
 * and the script SAYS SO rather than pretending otherwise:
 *   - Stripe: `deleteAccount()` cancels a live subscription first. If the
 *     account has `stripeSubscriptionId` set, this script refuses and tells
 *     you to cancel it in Stripe first.
 *   - Vercel Blob: uploaded photos are purged by `deleteUserBlobs()` before
 *     the cascade drops the rows pointing at them. If the account has photo
 *     rows, this script warns that the blobs will be orphaned.
 *
 * Usage — against PRODUCTION, creds inline so they never touch a file:
 *
 *   DATABASE_URL="libsql://<db>.turso.io" \
 *   DATABASE_AUTH_TOKEN="<token>" \
 *   npx tsx scripts/delete-user.mts auditross3
 *
 * …then re-run with `--yes` once the dry run looks right.
 */
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const username = process.argv[2]?.trim();
const confirmed = process.argv.includes("--yes");

if (!username || username.startsWith("--")) {
  console.error("usage: npx tsx scripts/delete-user.mts <username> [--yes]");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const db = drizzle(client, { schema });

const target = url.startsWith("file:") ? `LOCAL (${url})` : "PRODUCTION (turso)";
console.log(`\n▸ target : ${target}`);
console.log(`▸ user   : ${username}`);
console.log(`▸ mode   : ${confirmed ? "DELETE" : "dry run (pass --yes to delete)"}\n`);

const rows = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.username, username))
  .limit(1);

const user = rows[0];
if (!user) {
  console.log("No such user — nothing to do.");
  process.exit(0);
}

console.log(`found: id=${user.id}  email=${user.email}  created=${user.createdAt}`);

if (user.stripeSubscriptionId) {
  console.error(
    `\nREFUSING: this account has a Stripe subscription (${user.stripeSubscriptionId}).\n` +
      `Cancel it in Stripe first — the app's own deleteAccount() does that before\n` +
      `deleting, and this script will not leave a live subscription billing a row\n` +
      `that no longer exists.`,
  );
  process.exit(1);
}

// Count what the cascade will take, so the dry run is worth reading. Plain SQL
// against `user_id` rather than the typed builders: table shapes differ across
// the schema and a count is not worth a cast that could throw mid-run.
let owned = 0;
for (const table of [
  "projects",
  "recipes",
  "collection_paints",
  "collection_models",
]) {
  try {
    const r = await client.execute({
      sql: `select count(*) as n from ${table} where user_id = ?`,
      args: [user.id],
    });
    const n = Number(r.rows[0]?.n ?? 0);
    owned += n;
    console.log(`  ${table.padEnd(20)} ${n}`);
  } catch (e) {
    console.log(`  ${table.padEnd(20)} (skipped: ${(e as Error).message})`);
  }
}
console.log(`  ${"—".padEnd(20)} ${owned} row(s) the cascade will take\n`);

if (owned > 0) {
  console.log(
    "note: uploaded photos live in Vercel Blob and are NOT removed here. The\n" +
      "app's deleteAccount() purges them first; this script has no blob token.\n" +
      "For a test account that never uploaded one there is nothing to purge.\n",
  );
}

if (!confirmed) {
  console.log("\nDry run only. Re-run with --yes to delete.\n");
  process.exit(0);
}

await db.delete(schema.users).where(eq(schema.users.id, user.id));
console.log(`\nDeleted ${username}.\n`);
