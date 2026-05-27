/**
 * Phase 1 stub: hardcoded dev user.
 *
 * Real auth (NextAuth magic-link) lands in P1.3. Until then every
 * server action reads the user via this helper. When auth ships,
 * replace the implementation here with `auth()` from NextAuth and
 * the rest of the app keeps working unchanged.
 */
export const DEV_USER_ID = "dev_user__local";

export function currentUserId(): string {
  return DEV_USER_ID;
}
