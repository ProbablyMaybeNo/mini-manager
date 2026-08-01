"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { sendVerificationEmail } from "@/lib/auth/sendVerificationEmail";
import {
  SIGNUP_EMAIL_TOKEN_SCOPE,
  tokenIdentifier,
  VERIFY_TOKEN_LIFETIME_MS,
} from "@/lib/auth/tokens";
import {
  bumpAndCount,
  RateLimitBucket,
  utcDay,
} from "@/lib/rateLimit/quota";

export type ResendVerificationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Re-issue the signup email-verification link for the SIGNED-IN user.
 *
 * Why this exists: `signUp.ts` sent the verification mail exactly once, the
 * token lives for one hour (`VERIFY_TOKEN_LIFETIME_MS`), and nothing could
 * re-send it. Miss that window — or never receive the mail — and the account
 * was permanently unverifiable through the UI. That silently locks the user
 * out of anything gated on `emailVerified`, which today means the admin
 * allowlist (`/admin/comp`, `/admin/gallery`), and those routes `notFound()`
 * rather than explaining themselves, so there was no way to tell a missing
 * allowlist entry from an unverified address.
 *
 * Deliberately narrow: it only ever mails the address already on the account,
 * so it can't be used to send mail anywhere the user hasn't already proven
 * they control the account for. Re-issuing deletes any outstanding token for
 * the same scope, so old links stop working the moment a new one is sent.
 *
 * Shares the `signup` rate-limit bucket, keyed on the user id, so it can't be
 * used to hammer the mail provider.
 */
export async function resendSignupVerification(): Promise<ResendVerificationResult> {
  const userId = await currentUserId();

  const row = (
    await db
      .select({ email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  )[0];

  if (!row?.email) {
    return { ok: false, message: "This account has no email address." };
  }
  if (row.emailVerified) {
    // Not an error worth alarming anyone with — say so plainly.
    return { ok: false, message: "That email is already verified." };
  }

  const sent = await bumpAndCount(
    RateLimitBucket.Signup,
    `resend:${userId}`,
    utcDay(),
  );
  if (sent > 5) {
    return {
      ok: false,
      message: "Too many verification emails today. Try again tomorrow.",
    };
  }

  const identifier = tokenIdentifier(SIGNUP_EMAIL_TOKEN_SCOPE, userId);
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  const token = nanoid(40);
  await db.insert(verificationTokens).values({
    identifier,
    token,
    expires: new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS),
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;

  await sendVerificationEmail({
    to: row.email,
    subject: "Verify your email — The Mini Mainframe",
    text: `Confirm your email to finish setting up your account:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });

  return { ok: true };
}
