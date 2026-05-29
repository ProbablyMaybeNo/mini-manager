import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * Magic-link sign-in screen.
 *
 * Server action posts the email straight to NextAuth's `signIn("resend", ...)`
 * which writes a verification token + dispatches the email (or console-logs
 * the URL in dev). On success NextAuth redirects the browser to
 * `/sign-in?sent=1` (configured in `auth.ts`), which falls through to the
 * "check your inbox" branch below.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    from?: string;
    clone?: string;
  }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;
  const from = params.from;
  // `clone=1` is a hint for the CloneButton flow — we don't act on it
  // server-side here. After the magic-link click NextAuth redirects to
  // the `from` URL, which is `/r/<slug>?clone=1`, and AutoCloneOnMount
  // there finishes the work.

  // If already signed in, route either to the requested `from` URL (so
  // the public clone flow auto-completes) or to /projects.
  const session = await auth();
  if (session?.user) {
    const safeFrom =
      from && from.startsWith("/") && !from.startsWith("//") ? from : null;
    redirect(safeFrom ?? "/projects");
  }

  // After the magic-link click NextAuth will redirect the browser to
  // `redirectTarget`. When the visitor came from `/r/<slug>?clone=1` we
  // send them back there so the AutoCloneOnMount component finishes the
  // clone with no extra click; otherwise the default app landing.
  const safeFromRaw =
    from && from.startsWith("/") && !from.startsWith("//") ? from : null;
  const redirectTarget = safeFromRaw ?? "/projects";

  async function submit(formData: FormData): Promise<void> {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", {
      email,
      redirectTo: redirectTarget,
    });
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl">┌─ MINI MANAGER ─</h1>
          <p className="text-sm text-[var(--color-fg-muted)] font-sans">
            Wargaming + painting companion. Sign in with a magic link — no
            password to remember.
          </p>
        </header>

        {sent ? (
          <div className="frame p-6 space-y-3">
            <h2 className="text-lg glow-green">[ check your inbox ]</h2>
            <p className="text-sm text-[var(--color-fg-muted)] font-sans">
              A sign-in link has been sent. Click it from the same device to
              finish signing in. The link expires in 24 hours.
            </p>
            <p className="text-2xs font-mono text-[var(--color-fg-subtle)] uppercase tracking-wider pt-2 border-t border-[var(--color-border)]">
              dev mode: check the Next.js server console for the URL if email
              transport isn&apos;t configured.
            </p>
          </div>
        ) : (
          <form action={submit} className="frame p-6 space-y-4">
            <label className="block space-y-2">
              <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-green)]"
              />
            </label>

            {error ? (
              <p
                role="alert"
                className="text-xs font-mono text-[var(--color-amber)]"
              >
                [ ! ] {decodeURIComponent(error)}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full px-4 py-2 frame-strong tap-target text-sm font-mono hover:bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)] hover:text-[var(--color-green)]"
            >
              [ send magic link ]
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
