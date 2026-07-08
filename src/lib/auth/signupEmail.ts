"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { SIGNUP_EMAIL_TOKEN_SCOPE } from "@/lib/auth/tokens";

export type VerifyEmailResult = { ok: true } | { ok: false; message: string };

/**
 * Consume a signup email-verification token and stamp `users.emailVerified`.
 *
 * Looked up by token value alone (NOT the current session) so the link works
 * logged-out / on another device. The owning userId is recovered from the
 * token's identifier (`signup-email:<userId>`). Wrong / expired / non-signup
 * tokens fail with a generic message.
 */
export async function verifySignupEmailToken(input: {
  token: string;
}): Promise<VerifyEmailResult> {
  const token = input.token.trim();
  if (!token) return { ok: false, message: "Missing verification token" };

  const hit = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.token, token))
    .limit(1);

  const row = hit[0];
  const prefix = `${SIGNUP_EMAIL_TOKEN_SCOPE}:`;
  if (!row || !row.identifier.startsWith(prefix)) {
    return { ok: false, message: "Verification link is invalid or expired" };
  }
  const userId = row.identifier.slice(prefix.length);

  if (row.expires.getTime() < Date.now()) {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, row.identifier),
          eq(verificationTokens.token, token),
        ),
      );
    return { ok: false, message: "Verification link has expired" };
  }

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, userId));
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, row.identifier));

  return { ok: true };
}
