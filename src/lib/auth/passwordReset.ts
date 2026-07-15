"use server";

import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { sessions, users, verificationTokens } from "@/db/schema";
import { hashPassword } from "./password";
import { createSession } from "./session";
import {
  PASSWORD_RESET_TOKEN_SCOPE,
  tokenIdentifier,
  VERIFY_TOKEN_LIFETIME_MS,
} from "./tokens";
import { sendVerificationEmail } from "./sendVerificationEmail";
import {
  PASSWORD_ERROR_COPY,
  validatePassword,
  validateUsername,
} from "./validation";

export type RequestResult = { ok: true } | { ok: false; message: string };

export type ApplyResetResult =
  | { ok: true }
  | { ok: false; message: string };

function buildResetUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/sign-in/reset?token=${encodeURIComponent(token)}`;
}

/**
 * Forgot-password handler.
 *
 * **Enumeration safety**: this function ALWAYS returns ok:true. The
 * caller renders the same 'If an account exists, we sent a link' copy
 * regardless of whether the username matched or whether the account has
 * an email on file. Token issuance + mail dispatch only happen on the
 * happy branch — silently.
 *
 * The reset is issued against the mandatory `users.email` (every
 * credentials signup fills it) and is NOT gated on `emailVerified` — the
 * majority never click the verify link and would otherwise be locked out.
 *
 * The form is rate-limit-amenable; v1 ships without RL on the request
 * route and assumes Vercel's per-IP function-invocation backstop.
 */
export async function requestPasswordReset(input: {
  username: string;
}): Promise<RequestResult> {
  const v = validateUsername(input.username);

  // Malformed input — silent ok:true.
  if (!v.ok) return { ok: true };

  const hit = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${v.normalized}`)
    .limit(1);

  const user = hit[0];
  if (!user || !user.email) {
    // No account / no email on file — silent ok:true.
    return { ok: true };
  }

  const identifier = tokenIdentifier(PASSWORD_RESET_TOKEN_SCOPE, user.id);
  // One outstanding reset token at a time per user.
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));

  const token = nanoid(40);
  const expires = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS);
  await db.insert(verificationTokens).values({ identifier, token, expires });

  const url = buildResetUrl(token);
  await sendVerificationEmail({
    to: user.email,
    subject: "Reset your Mini Mainframe password",
    text: `Click to reset your password:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
  });

  return { ok: true };
}

/**
 * Apply a password-reset token: validate the new password, update the
 * hash, drop the token, mint a session. The caller (the reset page)
 * lands the user signed in straight away.
 */
export async function applyPasswordReset(input: {
  token: string;
  password: string;
}): Promise<ApplyResetResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, message: "Missing reset token" };
  }

  const p = validatePassword(input.password);
  if (!p.ok && p.error) {
    return { ok: false, message: PASSWORD_ERROR_COPY[p.error] };
  }

  // Token lookup is keyed on (identifier prefix, token). Since the
  // identifier is per-user we have to scan by token only — there is a
  // composite PK on (identifier, token) so the search remains cheap.
  const hits = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        sql`${verificationTokens.identifier} LIKE ${PASSWORD_RESET_TOKEN_SCOPE + ":%"}`,
        eq(verificationTokens.token, token),
      ),
    )
    .limit(1);

  const row = hits[0];
  if (!row) {
    return { ok: false, message: "Reset link is invalid or expired" };
  }
  if (row.expires.getTime() < Date.now()) {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, row.identifier),
          eq(verificationTokens.token, token),
        ),
      );
    return { ok: false, message: "Reset link has expired" };
  }

  const userId = row.identifier.slice(PASSWORD_RESET_TOKEN_SCOPE.length + 1);
  const hash = await hashPassword(input.password);

  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, userId));

  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, row.identifier),
        eq(verificationTokens.token, token),
      ),
    );

  // A stolen session cookie must not survive a reset — revoke every
  // existing session for this user, then mint the fresh one returned below.
  await db.delete(sessions).where(eq(sessions.userId, userId));

  await createSession(userId);
  return { ok: true };
}
