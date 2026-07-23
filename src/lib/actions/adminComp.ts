"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { isAdminUser } from "@/lib/admin/allowlist";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Admin-only comp-access mechanism (subscription paywall, fix 5 — Ross's
 * review pass). Lets an admin grant or revoke free subscriber access to a
 * signed-up account by username, without going through Stripe — for support
 * cases, press/partner accounts, or anyone Ross wants to comp by hand.
 *
 * Sets/clears `freeForeverGrantedAt`; `getPlanForUser` (plans.ts) already
 * resolves that column to permanent `pro_lifetime`, so this is the ONLY
 * writer of that column going forward (every prior grant — from the removed
 * testing-period "submit feedback" flow — was cleared in drizzle/0037).
 *
 * Gated exactly like the gallery admin actions (gallerySubmissions.ts):
 * `MM_ADMIN_EMAILS` allowlist + a VERIFIED email, re-checked here
 * server-side regardless of the page-level gate. This file must NOT import
 * `@/auth` directly (see recipeSharing.ts / projectImages.ts for why) — the
 * admin's email/verification is read via `currentUserId()` + a DB lookup.
 */

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const userId = await currentUserId();
  const rows = await db
    .select({ email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!isAdminUser(rows[0])) {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, userId };
}

const usernameSchema = z.object({
  username: z.string().trim().min(1).max(64),
});

export interface CompUserSummary {
  id: string;
  username: string | null;
  email: string | null;
  /** Null once revoked; the grant timestamp otherwise. */
  compGrantedAt: Date | null;
}

async function findByUsername(username: string): Promise<
  { id: string; username: string | null; email: string | null } | null
> {
  const rows = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

function revalidateAdminComp(): void {
  revalidatePath("/admin/comp");
}

/** Grant permanent, free subscriber access to the account with this
 *  username. Idempotent — granting an already-comped account just
 *  refreshes the timestamp. */
export async function grantCompAccess(
  raw: z.infer<typeof usernameSchema>,
): Promise<ActionResult<CompUserSummary>> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const target = await findByUsername(parsed.data.username);
  if (!target) {
    return { ok: false, error: `No account found for username "${parsed.data.username}"` };
  }

  const compGrantedAt = new Date();
  await db
    .update(users)
    .set({ freeForeverGrantedAt: compGrantedAt })
    .where(eq(users.id, target.id));
  revalidateAdminComp();

  return { ok: true, data: { ...target, compGrantedAt } };
}

/** Revoke comp access from the account with this username. A no-op
 *  (still `ok: true`) if the account wasn't comped to begin with. */
export async function revokeCompAccess(
  raw: z.infer<typeof usernameSchema>,
): Promise<ActionResult<CompUserSummary>> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const target = await findByUsername(parsed.data.username);
  if (!target) {
    return { ok: false, error: `No account found for username "${parsed.data.username}"` };
  }

  await db.update(users).set({ freeForeverGrantedAt: null }).where(eq(users.id, target.id));
  revalidateAdminComp();

  return { ok: true, data: { ...target, compGrantedAt: null } };
}
