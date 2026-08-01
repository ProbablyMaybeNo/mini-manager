import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { isAdminUser } from "@/lib/admin/allowlist";
import { countAllUsers, listAllUsers } from "@/db/queries/users";

// Accounts change as people sign up — render on request.
export const dynamic = "force-dynamic";

/**
 * `/admin/users` — the account roster.
 *
 * Exists because the owner had no way to see who had signed up. `/admin/comp`
 * searches only by exact username and lists only already-comped accounts, and
 * `/admin/gallery` is submissions — so "has <email> registered, and what's
 * their username?" required querying the production database by hand.
 *
 * Read-only by design: this page answers questions, it doesn't mutate. Comp
 * grants stay in `/admin/comp`, which re-checks the allowlist server-side in
 * its own actions — one writer, one place.
 *
 * Gated exactly like `/admin/comp` and `/admin/gallery`: `MM_ADMIN_EMAILS`
 * allowlist + a VERIFIED email, and non-admins (and anonymous visitors) get a
 * 404 rather than a "not authorized" page, so the route's existence isn't
 * advertised.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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

  const { q } = await searchParams;
  const [rows, total] = await Promise.all([listAllUsers(q), countAllUsers()]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 md:gap-6 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-title text-[clamp(1.125rem,2.8vw,1.78rem)] font-extrabold uppercase tracking-[0.15em] text-fg-bright">
          Accounts
        </h1>
        <span className="label-osd text-fg-dim">
          {q ? `${rows.length} matching · ` : ""}
          {total} total
        </span>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search username or email…"
          aria-label="Search accounts by username or email"
          className="min-h-11 min-w-0 flex-1 rounded-[6px] border border-border bg-surface-2 px-3 font-body text-[16px] text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none sm:text-body"
        />
        <button
          type="submit"
          className="min-h-11 rounded-[6px] border border-cyan bg-cyan px-4 font-display text-button font-bold uppercase text-bg"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center rounded-[6px] border border-border px-4 font-display text-button font-bold uppercase text-fg"
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="rounded-[12px] border border-border bg-surface p-6 text-center font-body text-body text-fg-dim">
          {q ? `No account matches “${q}”.` : "No accounts yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-1 rounded-[12px] border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[15px] font-bold text-fg-bright">
                  {u.username ?? "(no username)"}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {u.freeForeverGrantedAt && (
                    <span className="rounded-[4px] border border-green/25 bg-green/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-green">
                      comped
                    </span>
                  )}
                  {!u.emailVerified && (
                    <span className="rounded-[4px] border border-yellow/25 bg-yellow/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-yellow">
                      unverified
                    </span>
                  )}
                  <span className="font-mono text-[11px] uppercase text-fg-dim">
                    {u.plan ?? "free"}
                  </span>
                </span>
              </div>
              <span className="break-words font-mono text-[12px] text-fg-dim">
                {u.email ?? "(no email)"}
              </span>
              {/* Null for every account created before the column existed —
                  shown as such rather than back-filled with a fake date. */}
              <span className="font-mono text-[11px] text-fg-faint">
                {u.createdAt
                  ? `signed up ${u.createdAt.toISOString().slice(0, 10)}`
                  : "signed up before dates were recorded"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rows.length >= 200 && (
        <p className="font-body text-body text-fg-dim">
          ▸ Showing the first 200 — narrow it with a search.
        </p>
      )}

      <Link
        href="/admin/comp"
        className="inline-flex min-h-11 items-center font-body text-body text-cyan-lite underline-offset-4 hover:underline"
      >
        Grant or revoke comp access →
      </Link>
    </div>
  );
}
