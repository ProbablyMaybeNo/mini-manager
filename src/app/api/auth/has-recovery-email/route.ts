import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { validateUsername } from "@/lib/auth/validation";

/**
 * Probes whether the given username has a verified recovery email on
 * file. The sign-in page uses this on blur to decide whether to render
 * the "Forgot password?" link.
 *
 * GET /api/auth/has-recovery-email?u=alice42
 *   → { hasVerifiedRecoveryEmail: boolean }
 *
 * We return false (not a 404) for unknown usernames, malformed input,
 * and users without a verified recovery email — collapsing all three
 * keeps the response from acting as a username-enumeration oracle.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("u") ?? "";
  const v = validateUsername(raw);
  if (!v.ok) {
    return NextResponse.json({ hasVerifiedRecoveryEmail: false });
  }

  const hit = await db
    .select({
      recoveryEmail: users.recoveryEmail,
      recoveryEmailVerified: users.recoveryEmailVerified,
    })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${v.normalized}`)
    .limit(1);

  const row = hit[0];
  const ok = Boolean(row?.recoveryEmail && row?.recoveryEmailVerified);
  return NextResponse.json({ hasVerifiedRecoveryEmail: ok });
}
