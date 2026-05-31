"use server";

import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { createSession } from "./session";
import {
  PASSWORD_ERROR_COPY,
  USERNAME_ERROR_COPY,
  validatePassword,
  validateUsername,
} from "./validation";

export type SignUpResult =
  | { ok: true; userId: string; username: string }
  | { ok: false; field: "username" | "password" | "form"; message: string };

/**
 * Create a free-tier account with username + password. No email — email
 * is the upgrade gate (P9.5 adds recovery email + verification).
 *
 * Uniqueness is enforced application-side via a case-insensitive lookup
 * on `LOWER(username)` since SQLite's UNIQUE on `username` is
 * case-sensitive. The normalised lowercase form is what we store.
 */
export async function signUpWithCredentials(input: {
  username: string;
  password: string;
}): Promise<SignUpResult> {
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

  // Case-insensitive uniqueness check. We store the already-normalised
  // form, so this is belt-and-braces against any historical mixed-case
  // rows.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${u.normalized}`)
    .limit(1);

  if (existing[0]) {
    return {
      ok: false,
      field: "username",
      message: "That username is already taken",
    };
  }

  const hash = await hashPassword(input.password);
  const userId = nanoid(16);

  await db.insert(users).values({
    id: userId,
    // `name` mirrors the username so the NavRail / MobileHeader pick
    // up a friendly display label without an extra query. Users can
    // never change it (immutable v1); when they do, both fields move
    // together.
    name: u.normalized,
    username: u.normalized,
    passwordHash: hash,
    plan: "free",
  });

  await createSession(userId);
  return { ok: true, userId, username: u.normalized };
}

/**
 * Verify username + password and mint a session. Used by the sign-in
 * server action. Returns ok/false rather than throwing so the caller
 * can render a generic "wrong username or password" pill without
 * leaking which field was wrong.
 */
export async function signInWithCredentials(input: {
  username: string;
  password: string;
}): Promise<
  | { ok: true; userId: string; username: string }
  | { ok: false; message: string }
> {
  const u = validateUsername(input.username);
  // For sign-in we don't surface the validator's specific tag — we map
  // anything malformed to the same generic message.
  if (!u.ok) {
    return { ok: false, message: "Wrong username or password" };
  }
  if (!input.password) {
    return { ok: false, message: "Wrong username or password" };
  }

  const row = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, u.normalized))
    .limit(1);

  const user = row[0];
  if (!user || !user.passwordHash) {
    return { ok: false, message: "Wrong username or password" };
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    return { ok: false, message: "Wrong username or password" };
  }

  await createSession(user.id);
  return { ok: true, userId: user.id, username: user.username ?? u.normalized };
}
