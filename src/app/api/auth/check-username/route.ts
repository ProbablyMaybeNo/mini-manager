import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  USERNAME_ERROR_COPY,
  validateUsername,
} from "@/lib/auth/validation";

/**
 * Live username uniqueness probe for the sign-up + finish-account forms.
 *
 * GET /api/auth/check-username?u=alice42
 *
 * Returns `{ ok: true }` when the (normalised) username is both
 * well-formed AND not taken, otherwise `{ ok: false, reason }`. We
 * collapse "invalid format" and "already taken" into a single response
 * shape so the form pill can render either case the same way; the
 * `reason` string is the user-visible copy from validation.ts.
 *
 * The endpoint is debounced client-side. Rate-limiting is out of scope
 * for v1 — the response leaks nothing more than the sign-up POST would,
 * and an attacker enumerating usernames learns nothing useful (no email,
 * no created-at, no other PII).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("u") ?? "";
  const v = validateUsername(raw);
  if (!v.ok && v.error) {
    return NextResponse.json({
      ok: false,
      reason: USERNAME_ERROR_COPY[v.error],
    });
  }

  const hit = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${v.normalized}`)
    .limit(1);

  if (hit[0]) {
    return NextResponse.json({
      ok: false,
      reason: "That username is already taken",
    });
  }
  return NextResponse.json({ ok: true });
}
