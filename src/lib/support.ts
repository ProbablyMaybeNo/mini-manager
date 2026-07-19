/**
 * Support / contact email surfaced across the app: the public footer, the
 * privacy + terms pages, the sign-in and password-reset pages, and the
 * "Report an issue" form (so people without an account still have a channel).
 *
 * Reads `NEXT_PUBLIC_SUPPORT_EMAIL` first so the value is available in client
 * components too (bare `SUPPORT_EMAIL` is stripped from client bundles), then
 * the server-only `SUPPORT_EMAIL`, then a clearly-marked placeholder.
 *
 * NEEDS-ROSS: set `SUPPORT_EMAIL` **and** `NEXT_PUBLIC_SUPPORT_EMAIL` in the
 * Vercel project env to the real support address. Until then this renders the
 * placeholder below, which is obviously not a real inbox.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
  process.env.SUPPORT_EMAIL?.trim() ||
  "CHANGE_ME@mini-mainframe.com";

/** `mailto:` href for the support address, with an optional subject line. */
export function supportMailto(subject?: string): string {
  const base = `mailto:${SUPPORT_EMAIL}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}

/**
 * Optional "support the project" (donation) link shown on the pricing page.
 * Empty when unset, so the UI renders plain text / hides the button rather than
 * a dead link.
 *
 * NEEDS-ROSS: set `NEXT_PUBLIC_SUPPORT_URL` in the Vercel env to the real
 * support/donation URL (Ko-fi / Buy Me a Coffee / Stripe payment link / etc.).
 */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() ||
  process.env.SUPPORT_URL?.trim() ||
  "";

/** True once a real support/donation URL is configured. */
export const hasSupportUrl = SUPPORT_URL.length > 0;
