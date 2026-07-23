import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { isAdminUser } from "@/lib/admin/allowlist";
import { listCompedUsers } from "@/db/queries/users";
import { AdminCompPanel } from "./AdminCompPanel";

// Comped accounts change as Ross grants/revokes — render on request.
export const dynamic = "force-dynamic";

/**
 * Subscription-paywall admin comp mechanism (fix 5, Ross's review pass) —
 * grant or revoke free subscriber access to a signed-up account by
 * username, without going through Stripe. Gated to `MM_ADMIN_EMAILS` (see
 * `src/lib/admin/allowlist.ts`), same pattern as `/admin/gallery`:
 * non-admins (and anonymous visitors) 404 rather than see a "not
 * authorized" page, so the route's existence isn't advertised.
 *
 * `grantCompAccess` / `revokeCompAccess` (called by the client component
 * below) independently re-check the admin allowlist server-side — this
 * page-level gate is a UX convenience, not the only enforcement.
 */
export default async function AdminCompPage() {
  const session = await auth();
  const userId = session?.user?.id;
  // Read email + emailVerified from the DB rather than trusting the session
  // token — admin requires a VERIFIED email, which the session claim omits.
  const adminRow = userId
    ? (
        await db
          .select({ email: users.email, emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      )[0]
    : undefined;
  if (!isAdminUser(adminRow)) notFound();

  const comped = await listCompedUsers();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-title text-title uppercase text-cyan-lite text-glow-cyan">
          Comp access
        </h1>
        <p className="max-w-2xl font-body text-body text-fg">
          Grant an account full subscriber access without Stripe — support
          cases, press/partner accounts, or anyone you want to comp by hand.
          Enter their username exactly as they signed up with.
        </p>
        <Link
          href="/admin/gallery"
          className="w-fit font-body text-body text-cyan-lite underline-offset-4 hover:underline"
        >
          → Gallery review
        </Link>
      </header>

      <AdminCompPanel initialComped={comped} />
    </main>
  );
}
