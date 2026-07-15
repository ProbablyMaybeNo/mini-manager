/**
 * Recipe-card phase 3 — admin allowlist for the gallery review queue
 * (`/admin/gallery`). No roles table exists yet, so admin access is an
 * env-configured email allowlist: `MM_ADMIN_EMAILS`, a comma-separated list.
 *
 * FAILS CLOSED (E3): if `MM_ADMIN_EMAILS` is unset or empty, NOBODY is an
 * admin. There is no hard-coded fallback email — a missing env var must not
 * silently promote a hard-coded address (or let anyone who can register that
 * address self-grant moderation). Admin ALSO requires a VERIFIED email, so an
 * unverified, freely user-settable address can never open the gate.
 *
 * Set `MM_ADMIN_EMAILS` in the Vercel project env (comma-separated, e.g.
 * "admin@example.com,other@example.com"). The admin account's email must be
 * verified.
 *
 * Plain lib module (no "use server", no `@/auth` import) so it's safe to
 * import from both server components (the page-level gate) and action
 * files (the action-level gate) — action files must never import `@/auth`
 * (see recipeSharing.ts / projectImages.ts for why).
 */

function adminAllowlist(): ReadonlySet<string> {
  const raw = process.env.MM_ADMIN_EMAILS?.trim();
  // Fail closed — no fallback. Unset/empty ⇒ empty allowlist ⇒ nobody is admin.
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * True only when the user's email is in `MM_ADMIN_EMAILS` AND that email is
 * verified. Either missing — no email, unverified email, or an email not on
 * the allowlist — is not an admin.
 */
export function isAdminUser(
  user:
    | { email: string | null | undefined; emailVerified: Date | null | undefined }
    | null
    | undefined,
): boolean {
  if (!user?.email) return false;
  if (!user.emailVerified) return false;
  return adminAllowlist().has(user.email.trim().toLowerCase());
}
