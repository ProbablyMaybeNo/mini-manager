import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { isAdminUser } from "@/lib/admin/allowlist";
import { listPendingGallerySubmissions } from "@/db/queries/gallerySubmissions";
import { AdminGalleryReview } from "./AdminGalleryReview";

// Pending submissions change as painters submit — render on request.
export const dynamic = "force-dynamic";

/**
 * Recipe-card phase 3 — the gallery moderation queue. Gated to
 * `MM_ADMIN_EMAILS` (see `src/lib/admin/allowlist.ts`); non-admins (and
 * anonymous visitors) 404 rather than see a "not authorized" page, so the
 * route's existence isn't advertised.
 *
 * `approveGallerySubmission` / `rejectGallerySubmission` (called by the
 * client component below) independently re-check the admin allowlist
 * server-side — this page-level gate is a UX convenience, not the only
 * enforcement.
 */
export default async function AdminGalleryPage() {
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

  const pending = await listPendingGallerySubmissions();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-title text-title uppercase text-cyan-lite text-glow-cyan">
          Gallery review
        </h1>
        <p className="max-w-2xl font-body text-body text-fg">
          Recipe cards submitted for the public `/gallery`. Approve to list, reject
          to decline (the card image is removed either way once you act).
        </p>
      </header>

      <AdminGalleryReview initialSubmissions={pending} />
    </main>
  );
}
