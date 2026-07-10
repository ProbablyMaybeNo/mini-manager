/**
 * Recipe-card phase 3 — admin allowlist for the gallery review queue
 * (`/admin/gallery`). No roles table exists yet, so admin access is a
 * simple env-configured email allowlist: `MM_ADMIN_EMAILS`, a
 * comma-separated list of admin emails.
 *
 * TODO(Ross): set `MM_ADMIN_EMAILS` in the Vercel project env (comma-
 * separated, e.g. "admin@hrumf.com,other@example.com"). Until it's set,
 * this falls back to the app owner's email below so the gate isn't wide
 * open by default.
 *
 * Plain lib module (no "use server", no `@/auth` import) so it's safe to
 * import from both server components (the page-level gate) and action
 * files (the action-level gate) — action files must never import `@/auth`
 * (see recipeSharing.ts / projectImages.ts for why).
 */

const FALLBACK_ADMIN_EMAIL = "admin@hrumf.com";

function adminAllowlist(): ReadonlySet<string> {
  const raw = process.env.MM_ADMIN_EMAILS?.trim();
  const source = raw && raw.length > 0 ? raw : FALLBACK_ADMIN_EMAIL;
  return new Set(
    source
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminAllowlist().has(email.trim().toLowerCase());
}
