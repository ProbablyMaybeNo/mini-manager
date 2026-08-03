import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitCounters } from "@/db/schema";

/**
 * E7 — DB-counter quotas. A hard abuse ceiling that is INDEPENDENT of
 * billing: it always applies, on the free tier and the paid tier alike, so a
 * single account (or IP) can't drain the AI/vision APIs or flood the gallery
 * / signup. No external service — just a counter row per
 * (bucket, subject, window).
 *
 * Two window modes:
 *
 *   DAILY (`enforceDailyLimit`) — a UTC-day counter. Right for buckets whose
 *   subject is a userId the attacker cannot choose, and where a day-long
 *   refusal is an acceptable answer: the paid API spend buckets.
 *
 *   WINDOWED (`enforceWindowedLimit`, R2-19/R2-18) — a fixed short window,
 *   minutes not days. Required for the AUTH paths, where the daily mode is
 *   actively wrong: its subject is an IP (locking out a whole office/CGNAT
 *   for the rest of the day — the `Signup` bucket already did exactly that to
 *   the E2E suite) or a username the attacker picks (letting the attacker
 *   deny the real owner for a day). A short window keeps the ceiling but
 *   makes the worst case minutes of degraded service instead.
 */

export const RateLimitBucket = {
  RecipeAi: "recipe_ai",
  GallerySubmit: "gallery_submit",
  Signup: "signup",
  PaintScan: "paint_scan",
  PasswordReset: "password_reset",
  OutboundEmail: "outbound_email",
  SignIn: "sign_in",
} as const;
export type RateLimitBucket = (typeof RateLimitBucket)[keyof typeof RateLimitBucket];

/** UTC calendar day, "YYYY-MM-DD" — the reset window for every daily counter. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Fixed-window id, e.g. `w900000:1902355`. The window LENGTH is baked into
 * the string, so one (bucket, subject) can be metered at several window sizes
 * simultaneously without the rows colliding on the (bucket, subject, window)
 * primary key — that is what lets a caller stack a burst tier and a longer
 * tier with two calls and no extra schema.
 *
 * Fixed, not sliding: a burst straddling a boundary can pass up to 2×limit.
 * Accepted deliberately — it costs one extra window's worth of attempts on a
 * ceiling that is already generous, and a sliding window would need per-hit
 * rows rather than one counter.
 */
export function fixedWindow(windowMs: number, now: Date = new Date()): string {
  return `w${windowMs}:${Math.floor(now.getTime() / windowMs)}`;
}

/** Positive-integer env override, else the fallback. */
function envLimit(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default daily caps — generous for a real user, a wall for abuse. */
export function recipeAiDailyLimit(): number {
  return envLimit("MM_AI_DAILY_LIMIT", 50);
}
export function gallerySubmitDailyLimit(): number {
  return envLimit("MM_GALLERY_DAILY_LIMIT", 20);
}
export function signupDailyLimitPerIp(): number {
  return envLimit("MM_SIGNUP_DAILY_LIMIT", 10);
}
/** Paint-scan (vision) calls cost money per photo — cap it, same as the
 *  gallery moderation and AI recipe buckets. */
export function paintScanDailyLimit(): number {
  return envLimit("MM_SCAN_DAILY_LIMIT", 20);
}

/* --- Windowed (auth) buckets ------------------------------------------- */

/** R2-19 — forgot-password requests per username. 15 minutes, not a day:
 *  the subject is a username the ATTACKER supplies, so every minute of the
 *  window is also a minute the real owner is held off their own reset. */
export const PASSWORD_RESET_WINDOW_MS = 15 * 60_000;
export function passwordResetWindowLimit(): number {
  return envLimit("MM_RESET_WINDOW_LIMIT", 3);
}

/** R2-19 — chokepoint cap on outbound mail per recipient address. Sized
 *  above the reset cap so it never becomes the binding constraint on a
 *  legitimate user who also triggers a signup/recovery verification. */
export const OUTBOUND_EMAIL_WINDOW_MS = 15 * 60_000;
export function outboundEmailWindowLimit(): number {
  return envLimit("MM_MAIL_WINDOW_LIMIT", 5);
}

/**
 * R2-18 — sign-in attempts, in two tiers, which together are the backoff:
 * the burst tier caps a flurry, and the sustained tier makes the permitted
 * rate DECAY the longer an attack runs (120/hr for the first quarter hour,
 * then ~30/hr). Both are counted since the last SUCCESSFUL sign-in for that
 * subject, so a real user's successes never accumulate toward the cap.
 */
export const SIGN_IN_BURST_WINDOW_MS = 5 * 60_000;
export const SIGN_IN_SUSTAINED_WINDOW_MS = 60 * 60_000;
export function signInBurstLimit(): number {
  return envLimit("MM_SIGNIN_BURST_LIMIT", 10);
}
export function signInSustainedLimit(): number {
  return envLimit("MM_SIGNIN_HOURLY_LIMIT", 30);
}

/**
 * Atomically increment the (bucket, subject, window) counter and return the
 * NEW count. INSERT ... ON CONFLICT means two concurrent requests can't both
 * read the same pre-increment value and slip past the cap.
 */
export async function bumpAndCount(
  bucket: RateLimitBucket,
  subject: string,
  window: string = utcDay(),
): Promise<number> {
  const rows = await db
    .insert(rateLimitCounters)
    .values({ bucket, subject, window, count: 1 })
    .onConflictDoUpdate({
      target: [
        rateLimitCounters.bucket,
        rateLimitCounters.subject,
        rateLimitCounters.window,
      ],
      set: { count: sql`${rateLimitCounters.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: rateLimitCounters.count });
  return rows[0]?.count ?? 0;
}

export type LimitResult = { allowed: boolean; count: number; limit: number };

/**
 * Enforce a daily cap for one subject. Increments FIRST, then checks — the
 * atomic increment is the gate, so the limit holds under concurrency. The
 * `limit`-th call in a day is allowed; the (limit+1)-th is refused. A refused
 * call still increments (it's already over the cap, so this is immaterial and
 * discourages hammering).
 */
export async function enforceDailyLimit(
  bucket: RateLimitBucket,
  subject: string,
  limit: number,
  now: Date = new Date(),
): Promise<LimitResult> {
  const count = await bumpAndCount(bucket, subject, utcDay(now));
  return { allowed: count <= limit, count, limit };
}

/**
 * Same contract as `enforceDailyLimit`, over a short fixed window instead of
 * a UTC day. Increments FIRST, then checks, so the atomic increment is still
 * the gate under concurrency.
 *
 * Stack tiers by calling twice with different `windowMs` — the window id
 * encodes its own length, so the tiers get separate rows for free.
 */
export async function enforceWindowedLimit(
  bucket: RateLimitBucket,
  subject: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<LimitResult> {
  const count = await bumpAndCount(bucket, subject, fixedWindow(windowMs, now));
  return { allowed: count <= limit, count, limit };
}

/**
 * Drop every counter for one (bucket, subject), across all windows and both
 * modes. Lets a caller meter ATTEMPTS while charging only for the ones that
 * failed: bump on the way in, clear on success (R2-18). Without it, ten
 * legitimate consecutive sign-ins would trip a limiter aimed at ten failures.
 */
export async function clearLimit(
  bucket: RateLimitBucket,
  subject: string,
): Promise<void> {
  await db
    .delete(rateLimitCounters)
    .where(
      and(
        eq(rateLimitCounters.bucket, bucket),
        eq(rateLimitCounters.subject, subject),
      ),
    );
}
