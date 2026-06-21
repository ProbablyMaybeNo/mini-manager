import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Personal browser-extension token.
 *
 * The "Mini Manager Collection" Chrome extension authenticates every
 * request with a single long-lived bearer token the user generates once
 * in Settings → Browser extension and pastes into the extension.
 *
 * Design — signed HMAC, **no server-side token storage**:
 *
 *   token = `<userId>.v<version>.<sig>`
 *   sig   = base64url( HMAC-SHA256( `<userId>.v<version>`, AUTH_SECRET ) )
 *
 * Verification recomputes the signature from the userId + the user's
 * CURRENT `extensionTokenVersion` (read from the DB) and compares in
 * constant time. Because the signed payload includes the version,
 * "Regenerate" simply bumps `extensionTokenVersion` — every previously
 * issued token now signs a stale version and fails verification. No
 * token hashes to store, no revocation list to maintain.
 *
 * The HMAC key is `AUTH_SECRET` (the NextAuth/Auth.js secret already
 * present in every deployment). Tokens are therefore as strong as the
 * app's session secret and are invalidated wholesale if that secret is
 * ever rotated — an acceptable, and arguably desirable, property.
 */

/** Separator between the three token segments. */
const SEP = ".";

/**
 * Resolve the HMAC key. `AUTH_SECRET` is the Auth.js v5 secret; we fall
 * back to the legacy `NEXTAUTH_SECRET` name for parity with older
 * deployments. Throwing here (rather than signing with a weak/empty key)
 * is deliberate — a missing secret is a deploy misconfiguration, not a
 * per-request error to swallow.
 */
function hmacKey(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set — cannot sign/verify extension tokens",
    );
  }
  return secret;
}

/** base64url (no padding) of an HMAC over `payload`. */
function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

/** Constant-time string compare that tolerates length differences. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/* ============================================================
   Pure core — no DB, fully unit-testable
   ============================================================ */

/**
 * Build a token string for `userId` at `version` using `secret`. Pure;
 * the DB wrapper `issueExtensionToken` supplies the real version + key.
 */
export function buildExtensionToken(
  userId: string,
  version: number,
  secret: string,
): string {
  const payload = `${userId}${SEP}v${version}`;
  return `${payload}${SEP}${sign(payload, secret)}`;
}

/**
 * Verify a token against an expected `version` + `secret`. Returns the
 * embedded userId on success, or `null` for any malformed / tampered /
 * stale-version / wrong-signature token. Pure; never throws on bad input.
 */
export function verifyExtensionTokenWith(
  token: string,
  expectedVersion: number,
  secret: string,
): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(SEP);
  // Exactly three segments: userId, `v<version>`, signature. A nanoid
  // userId contains no "." so this split is unambiguous.
  if (parts.length !== 3) return null;
  const [userId, versionSeg, sig] = parts;
  if (!userId || !versionSeg || !sig) return null;
  if (!versionSeg.startsWith("v")) return null;

  const version = Number(versionSeg.slice(1));
  if (!Number.isInteger(version) || version < 0) return null;
  if (version !== expectedVersion) return null;

  const payload = `${userId}${SEP}${versionSeg}`;
  const expectedSig = sign(payload, secret);
  if (!safeEqual(sig, expectedSig)) return null;

  return userId;
}

/* ============================================================
   DB-backed wrappers — used by the app + the extension API
   ============================================================ */

/**
 * Issue a fresh token for `userId` signing the user's CURRENT
 * `extensionTokenVersion`. Does NOT bump the version (so re-issuing
 * yields the same token); use {@link regenerateExtensionToken} to
 * rotate. Returns `null` if the user row is gone.
 */
export async function issueExtensionToken(
  userId: string,
): Promise<string | null> {
  const row = await db
    .select({ version: users.extensionTokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const version = row[0]?.version;
  if (version === undefined) return null;
  return buildExtensionToken(userId, version, hmacKey());
}

/**
 * Bump the user's token version (invalidating every prior token) and
 * return a freshly signed token for the new version. Returns `null` if
 * the user row is gone.
 */
export async function regenerateExtensionToken(
  userId: string,
): Promise<string | null> {
  const updated = await db
    .update(users)
    .set({ extensionTokenVersion: sql`${users.extensionTokenVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ version: users.extensionTokenVersion });
  const version = updated[0]?.version;
  if (version === undefined) return null;
  return buildExtensionToken(userId, version, hmacKey());
}

/**
 * Verify a bearer token coming from the extension. Reads the user's
 * current version from the DB and compares. Returns the userId on
 * success, else `null`. Never throws on malformed input (it can still
 * throw if AUTH_SECRET is unset — a deploy error, not a request error).
 */
export async function verifyExtensionToken(
  token: string,
): Promise<string | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  const userId = token.split(SEP)[0];
  if (!userId) return null;

  const row = await db
    .select({ version: users.extensionTokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const version = row[0]?.version;
  if (version === undefined) return null;

  return verifyExtensionTokenWith(token, version, hmacKey());
}
