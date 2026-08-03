"use server";

import { cookies, headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { ACQUISITION_COOKIE, parseAcquisitionSource } from "@/lib/acquisition";
import {
  clearLimit,
  enforceDailyLimit,
  enforceWindowedLimit,
  RateLimitBucket,
  SIGN_IN_BURST_WINDOW_MS,
  SIGN_IN_SUSTAINED_WINDOW_MS,
  signInBurstLimit,
  signInSustainedLimit,
  signupDailyLimitPerIp,
} from "@/lib/rateLimit/quota";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { hashPassword, verifyPassword } from "./password";
import { createSession } from "./session";
import { sendVerificationEmail } from "./sendVerificationEmail";
import {
  SIGNUP_EMAIL_TOKEN_SCOPE,
  tokenIdentifier,
  VERIFY_TOKEN_LIFETIME_MS,
} from "./tokens";
import {
  PASSWORD_ERROR_COPY,
  USERNAME_ERROR_COPY,
  validatePassword,
  validateUsername,
} from "./validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignUpResult =
  | { ok: true; userId: string; username: string }
  | { ok: false; field: "username" | "password" | "email" | "form"; message: string };

/**
 * Create a free-tier account with username + password. No email — email
 * is the upgrade gate (P9.5 adds recovery email + verification).
 *
 * Uniqueness is enforced application-side via a case-insensitive lookup
 * on `LOWER(username)` since SQLite's UNIQUE on `username` is
 * case-sensitive. The normalised lowercase form is what we store.
 */
export async function signUpWithCredentials(input: {
  username: string;
  password: string;
  email: string;
}): Promise<SignUpResult> {
  const u = validateUsername(input.username);
  if (!u.ok && u.error) {
    return {
      ok: false,
      field: "username",
      message: USERNAME_ERROR_COPY[u.error],
    };
  }

  const p = validatePassword(input.password);
  if (!p.ok && p.error) {
    return {
      ok: false,
      field: "password",
      message: PASSWORD_ERROR_COPY[p.error],
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return {
      ok: false,
      field: "email",
      message: "Enter a valid email address",
    };
  }

  // IP-based signup rate limit (E7) — cap new accounts per client IP per day
  // so one host can't mass-create accounts. Independent of the billing flag.
  // Best-effort: if we can't determine the IP (missing proxy headers), we
  // don't block. Metered here, after cheap input validation, so a genuine
  // user's typo doesn't burn their network's budget.
  const ip = await clientIp();
  if (ip) {
    const limit = await enforceDailyLimit(
      RateLimitBucket.Signup,
      ip,
      signupDailyLimitPerIp(),
    );
    if (!limit.allowed) {
      return {
        ok: false,
        field: "form",
        message: "Too many sign-ups from your network today. Please try again tomorrow.",
      };
    }
  }

  // Case-insensitive uniqueness check. We store the already-normalised
  // form, so this is belt-and-braces against any historical mixed-case
  // rows.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${u.normalized}`)
    .limit(1);

  if (existing[0]) {
    return {
      ok: false,
      field: "username",
      message: "That username is already taken",
    };
  }

  const emailTaken = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken[0]) {
    return {
      ok: false,
      field: "email",
      message: "That email is already registered",
    };
  }

  const hash = await hashPassword(input.password);
  const userId = nanoid(16);

  // First-touch acquisition attribution — the proxy stamps this cookie
  // from ?ref=/utm_* on the visitor's first landing (src/lib/acquisition.ts).
  // Absent cookie => organic/direct signup, leave the column null.
  const jar = await cookies();
  const acquisitionRef = jar.get(ACQUISITION_COOKIE)?.value ?? null;

  await db.insert(users).values({
    id: userId,
    // `name` mirrors the username so the NavRail / MobileHeader pick
    // up a friendly display label without an extra query. Users can
    // never change it (immutable v1); when they do, both fields move
    // together.
    name: u.normalized,
    username: u.normalized,
    email,
    passwordHash: hash,
    plan: "free",
    acquisitionRef,
  });

  await createSession(userId);

  // Funnel: a new account exists. Attach the first-touch source (if any)
  // so the acquisition → signup join is visible in the analytics funnel,
  // and fire a dedicated source_captured event when a tracked link
  // actually brought this painter in.
  const source = parseAcquisitionSource(acquisitionRef);
  await trackServer(AnalyticsEvent.AccountCreated, {
    source: source?.ref ?? source?.utm_source ?? "organic",
  });
  if (source) {
    await trackServer(AnalyticsEvent.SourceCaptured, {
      ref: source.ref ?? null,
      utm_source: source.utm_source ?? null,
      utm_medium: source.utm_medium ?? null,
      utm_campaign: source.utm_campaign ?? null,
    });
  }

  // Fire the email-verification link. Non-fatal — the account already
  // exists, and without AUTH_RESEND_KEY the link is console-logged in dev.
  try {
    await issueSignupEmailToken(userId, email);
  } catch (err) {
    // Non-fatal: the account already exists and the user can re-request
    // verification later. But surface the reason in the server logs — a
    // silently-swallowed Resend rejection (e.g. an unverified sending
    // domain) is otherwise invisible and impossible to diagnose in prod.
    console.error(
      `[signup] verification email to ${email} failed:`,
      err instanceof Error ? err.message : err,
    );
  }
  return { ok: true, userId, username: u.normalized };
}

/**
 * Best-effort client IP from proxy headers (Vercel sets `x-forwarded-for`).
 * Returns the first hop, or null when no forwarding header is present.
 */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || null;
}

function signupVerifyUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Issue a one-time signup email-verification token and send the link. */
async function issueSignupEmailToken(userId: string, email: string): Promise<void> {
  const identifier = tokenIdentifier(SIGNUP_EMAIL_TOKEN_SCOPE, userId);
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  const token = nanoid(40);
  const expires = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS);
  await db.insert(verificationTokens).values({ identifier, token, expires });
  await sendVerificationEmail({
    to: email,
    subject: "Verify your email — The Mini Mainframe",
    text: `Welcome to The Mini Mainframe! Confirm your email to finish setting up your account:\n\n${signupVerifyUrl(token)}\n\nThis link expires in 1 hour. If you didn't sign up, ignore this email.`,
  });
}

/**
 * Verify username + password and mint a session. Used by the sign-in
 * server action. Returns ok/false rather than throwing so the caller
 * can render a generic "wrong username or password" pill without
 * leaking which field was wrong.
 *
 * **R2-18 — attempt limiting.** bcryptjs at cost 10 (~50ms) is a real
 * natural throttle, so this is not an offline-speed guessing surface. What
 * it does not touch is credential stuffing, where each known pair is a
 * single request and the hash cost buys nothing; and every attempt is a
 * billed serverless invocation, so a sustained run is a cost event too.
 *
 * The limiter is keyed on username + IP and metered before the lookup and
 * the hash, so a refused attempt is also the CHEAPEST one — which matters,
 * because billed duration is part of what is being defended. That is also
 * why the backoff is a decaying rate rather than a sleep: delaying the
 * response would hold a billed invocation open and pay the attacker's costs
 * for them.
 */
export async function signInWithCredentials(input: {
  username: string;
  password: string;
}): Promise<
  | { ok: true; userId: string; username: string }
  | { ok: false; message: string }
> {
  const u = validateUsername(input.username);
  // For sign-in we don't surface the validator's specific tag — we map
  // anything malformed to the same generic message.
  if (!u.ok) {
    return { ok: false, message: "Wrong username or password" };
  }
  if (!input.password) {
    return { ok: false, message: "Wrong username or password" };
  }

  // Composite subject on purpose. A username-only key would let an attacker
  // lock the real owner out of their own account by failing on their behalf
  // — the same denial-of-service R2-19 is about, pointed at the front door.
  // An IP-only key would punish everyone behind an office/CGNAT address.
  // Together, hammering one account from one host bounds only that pair.
  const ip = await clientIp();
  const attemptKey = `${u.normalized}|${ip ?? "-"}`;
  if (!(await withinSignInBudget(attemptKey))) {
    // Same generic string as every other failure. Sign-in has no
    // enumeration oracle today and a distinct "too many attempts" reply
    // would be one: it tells a prober that this username+IP pair is worth
    // the wait, and tells a stuffing run exactly when to rotate hosts.
    return { ok: false, message: "Wrong username or password" };
  }

  const row = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, u.normalized))
    .limit(1);

  const user = row[0];
  if (!user || !user.passwordHash) {
    return { ok: false, message: "Wrong username or password" };
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    return { ok: false, message: "Wrong username or password" };
  }

  // Success clears the tally, so the counter means "attempts since the last
  // good sign-in" rather than "attempts". A user who signs in repeatedly and
  // correctly can never throttle themselves.
  await clearLimit(RateLimitBucket.SignIn, attemptKey);

  await createSession(user.id);
  return { ok: true, userId: user.id, username: user.username ?? u.normalized };
}

/**
 * Two-tier sign-in budget for one username+IP pair. The tiers ARE the
 * backoff: the burst tier caps a flurry, and once it has been refilled a few
 * times the sustained tier takes over and the permitted rate decays. Short
 * windows throughout — the daily counter used by the signup bucket would
 * turn a bad afternoon into a lockout lasting until midnight UTC.
 */
async function withinSignInBudget(subject: string): Promise<boolean> {
  const burst = await enforceWindowedLimit(
    RateLimitBucket.SignIn,
    subject,
    signInBurstLimit(),
    SIGN_IN_BURST_WINDOW_MS,
  );
  // Short-circuit: a refused attempt should cost one write, not two, and
  // the sustained tier should count attempts that got as far as being tried.
  if (!burst.allowed) return false;

  const sustained = await enforceWindowedLimit(
    RateLimitBucket.SignIn,
    subject,
    signInSustainedLimit(),
    SIGN_IN_SUSTAINED_WINDOW_MS,
  );
  return sustained.allowed;
}
