"use server";

import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users, verificationTokens } from "@/db/schema";
import { ACQUISITION_COOKIE } from "@/lib/acquisition";
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
  // Fire the email-verification link (the real-email gate for the testing
  // period's free-forever reward). Non-fatal — the account already exists, and
  // without AUTH_RESEND_KEY the link is console-logged in dev.
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
    text: `Welcome to The Mini Mainframe! Confirm your email to lock in free-forever tester access:\n\n${signupVerifyUrl(token)}\n\nThis link expires in 1 hour. If you didn't sign up, ignore this email.`,
  });
}

/**
 * Verify username + password and mint a session. Used by the sign-in
 * server action. Returns ok/false rather than throwing so the caller
 * can render a generic "wrong username or password" pill without
 * leaking which field was wrong.
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

  await createSession(user.id);
  return { ok: true, userId: user.id, username: user.username ?? u.normalized };
}
