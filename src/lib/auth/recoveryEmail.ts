"use server";

import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import {
  RECOVERY_EMAIL_TOKEN_SCOPE,
  tokenIdentifier,
  VERIFY_TOKEN_LIFETIME_MS,
} from "./tokens";
import { sendVerificationEmail } from "./sendVerificationEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecoveryEmailResult =
  | { ok: true }
  | { ok: false; message: string };

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s) && s.length <= 254;
}

function buildVerifyUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/user/verify-recovery?token=${encodeURIComponent(token)}`;
}

/**
 * Attach (or replace) a recovery email. Stores it unverified and emails
 * the user a one-time link. Idempotent — calling again with a different
 * address replaces both the row state and the pending token.
 */
export async function setRecoveryEmail(input: {
  email: string;
}): Promise<RecoveryEmailResult> {
  const userId = await currentUserId();
  const email = input.email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address" };
  }

  await db
    .update(users)
    .set({ recoveryEmail: email, recoveryEmailVerified: null })
    .where(eq(users.id, userId));

  await issueRecoveryEmailToken({ userId, email });
  return { ok: true };
}

/** Re-send the verification email for the currently-pending recovery
 *  address. No-op if no recovery email is set. */
export async function resendRecoveryEmailVerification(): Promise<RecoveryEmailResult> {
  const userId = await currentUserId();
  const row = await db
    .select({ recoveryEmail: users.recoveryEmail })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const email = row[0]?.recoveryEmail;
  if (!email) {
    return { ok: false, message: "No recovery email on file" };
  }
  await issueRecoveryEmailToken({ userId, email });
  return { ok: true };
}

/** Clear the recovery email + drop any outstanding verify tokens. */
export async function removeRecoveryEmail(): Promise<RecoveryEmailResult> {
  const userId = await currentUserId();
  await db
    .update(users)
    .set({ recoveryEmail: null, recoveryEmailVerified: null })
    .where(eq(users.id, userId));

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, userId)));
  return { ok: true };
}

/**
 * Consume a recovery-email verification token. Returns ok on success;
 * the caller is expected to redirect to /user with a flash. Wrong /
 * expired / already-consumed tokens return ok:false silently.
 */
export async function verifyRecoveryEmailToken(input: {
  token: string;
}): Promise<RecoveryEmailResult> {
  const userId = await currentUserId();
  const identifier = tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, userId);

  const hit = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, input.token),
      ),
    )
    .limit(1);

  const row = hit[0];
  if (!row) {
    return { ok: false, message: "Verification link is invalid or expired" };
  }
  if (row.expires.getTime() < Date.now()) {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, input.token),
        ),
      );
    return { ok: false, message: "Verification link has expired" };
  }

  await db
    .update(users)
    .set({ recoveryEmailVerified: new Date() })
    .where(eq(users.id, userId));

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));

  return { ok: true };
}

/* --------------------------------------------------------------
   Internal helpers
   -------------------------------------------------------------- */

async function issueRecoveryEmailToken(input: {
  userId: string;
  email: string;
}): Promise<void> {
  const identifier = tokenIdentifier(RECOVERY_EMAIL_TOKEN_SCOPE, input.userId);
  // Drop any prior pending token first (one outstanding token per user).
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));

  const token = nanoid(40);
  const expires = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS);
  await db.insert(verificationTokens).values({ identifier, token, expires });

  const url = buildVerifyUrl(token);
  await sendVerificationEmail({
    to: input.email,
    subject: "Verify your Mini Manager recovery email",
    text: `Click to verify this address for password reset:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
  });
}
