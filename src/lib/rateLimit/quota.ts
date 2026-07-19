import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitCounters } from "@/db/schema";

/**
 * E7 — DB-counter daily quotas + a signup rate limit. A hard abuse ceiling
 * that is INDEPENDENT of billing: it always applies, on the free tier and the
 * paid tier alike, so a single account (or IP) can't drain the AI/vision APIs
 * or flood the gallery / signup. No external service — just a counter row per
 * (bucket, subject, UTC-day).
 */

export const RateLimitBucket = {
  RecipeAi: "recipe_ai",
  GallerySubmit: "gallery_submit",
  Signup: "signup",
  PaintScan: "paint_scan",
} as const;
export type RateLimitBucket = (typeof RateLimitBucket)[keyof typeof RateLimitBucket];

/** UTC calendar day, "YYYY-MM-DD" — the reset window for every counter. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
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
