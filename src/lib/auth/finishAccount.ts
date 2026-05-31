"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { hashPassword } from "./password";
import {
  PASSWORD_ERROR_COPY,
  USERNAME_ERROR_COPY,
  validatePassword,
  validateUsername,
} from "./validation";

export type FinishAccountResult =
  | { ok: true }
  | { ok: false; field: "username" | "password" | "form"; message: string };

/**
 * Complete a legacy magic-link account: pick a username + password.
 * The existing verified `email` is preserved as `recoveryEmail` (with
 * `recoveryEmailVerified` set to now, since the magic-link login is
 * the original proof-of-ownership) and the bare `email` column is
 * cleared — keeping the recovery address as the canonical reset
 * destination.
 *
 * Idempotent: if the account is already complete (username +
 * passwordHash set), the action returns ok and the page short-circuits
 * to /projects.
 */
export async function finishAccount(input: {
  username: string;
  password: string;
}): Promise<FinishAccountResult> {
  // Skip the migration redirect — we're literally on that page.
  const userId = await currentUserId({ skipMigrationCheck: true });

  const u = validateUsername(input.username);
  if (!u.ok && u.error) {
    return {
      ok: false,
      field: "username",
      message: USERNAME_ERROR_COPY[u.error],
    };
  }

  const p = validatePassword(input.password);
  if (!p.ok && p.error) {
    return {
      ok: false,
      field: "password",
      message: PASSWORD_ERROR_COPY[p.error],
    };
  }

  // Re-read the user. If the account is already complete this is a
  // no-op success — the page will redirect.
  const row = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!row) {
    return { ok: false, field: "form", message: "Account not found" };
  }
  if (row.passwordHash && row.username) {
    return { ok: true };
  }

  // Uniqueness check (case-insensitive) — exclude our own row in case
  // the user is re-attempting with the same chosen name.
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(
      sql`LOWER(${users.username}) = ${u.normalized} AND ${users.id} <> ${userId}`,
    )
    .limit(1);
  if (taken[0]) {
    return {
      ok: false,
      field: "username",
      message: "That username is already taken",
    };
  }

  const hash = await hashPassword(input.password);

  // Move email -> recoveryEmail and mark verified (the magic-link
  // confirmation is the proof). Existing recoveryEmail wins if already
  // set.
  const recoveryEmail = row.recoveryEmail ?? row.email ?? null;
  const recoveryEmailVerified =
    row.recoveryEmailVerified ?? (recoveryEmail ? new Date() : null);

  await db
    .update(users)
    .set({
      username: u.normalized,
      passwordHash: hash,
      email: null,
      recoveryEmail,
      recoveryEmailVerified,
    })
    .where(eq(users.id, userId));

  return { ok: true };
}
