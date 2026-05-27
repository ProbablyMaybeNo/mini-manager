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
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  // If already signed in, bounce straight back into the app.
  const session = await auth();
  if (session?.user) redirect("/projects");

  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;

  async function submit(formData: FormData): Promise<void> {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("resend", {
      email,
      redirectTo: "/sign-in?sent=1",
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
