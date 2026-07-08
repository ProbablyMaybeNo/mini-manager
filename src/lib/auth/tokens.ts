/**
 * Pure constants + helpers for the verificationTokens table.
 *
 * Lives in its own module so server-action files (which must export
 * only async functions) can import these without the "use server"
 * boundary tripping.
 */

/** Identifier scope for recovery-email verification (P9.5). */
export const RECOVERY_EMAIL_TOKEN_SCOPE = "recovery-email";

/** Identifier scope for password-reset tokens (P9.6). */
export const PASSWORD_RESET_TOKEN_SCOPE = "password-reset";
export const SIGNUP_EMAIL_TOKEN_SCOPE = "signup-email";

/** Both flows use a 1-hour token lifetime. */
export const VERIFY_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/** Compose the `identifier` column value. We namespace per flow so a
 *  password-reset token can never be replayed against the recovery
 *  verification endpoint and vice versa. */
export function tokenIdentifier(scope: string, userId: string): string {
  return `${scope}:${userId}`;
}
