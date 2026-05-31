/**
 * Username + password validation rules for the Phase 9 credentials flow.
 *
 * Pure functions only — these are imported by both the sign-up server
 * action (server-side enforcement) and the sign-up page client component
 * (live feedback). No `"use server"` directive: this file must not be
 * mistaken for a server action module.
 */

/** Usernames that resemble system endpoints or branded names. Sign-up
 *  rejects these case-insensitively. */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "root",
  "support",
  "mod",
  "system",
  "null",
  "me",
  "you",
  "ross",
  "billy",
  "api",
  "auth",
  "signin",
  "signup",
  "signout",
] as const;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;

/** 3–20 chars; lowercase letters / digits / `_` / `-`; first char must be
 *  a letter or digit. */
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;

export type UsernameError =
  | "empty"
  | "too-short"
  | "too-long"
  | "invalid-chars"
  | "must-start-with-alnum"
  | "reserved";

export interface UsernameResult {
  ok: boolean;
  error?: UsernameError;
  /** The normalised lowercase form. Use this for storage + uniqueness
   *  checks. */
  normalized: string;
}

/** Validate a username. Returns the normalised lowercase form plus an
 *  error tag if invalid. Reserved-word check uses the normalised form. */
export function validateUsername(raw: string): UsernameResult {
  const trimmed = (raw ?? "").trim();
  const normalized = trimmed.toLowerCase();

  if (!normalized) {
    return { ok: false, error: "empty", normalized };
  }
  // Reserved-word check runs first so short reserved tokens like
  // "me" / "you" still surface the right error tag.
  if (RESERVED_USERNAMES.includes(normalized)) {
    return { ok: false, error: "reserved", normalized };
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: "too-short", normalized };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: "too-long", normalized };
  }
  // Leading char must be alphanumeric.
  if (!/^[a-z0-9]/.test(normalized)) {
    return { ok: false, error: "must-start-with-alnum", normalized };
  }
  if (!USERNAME_RE.test(normalized)) {
    return { ok: false, error: "invalid-chars", normalized };
  }
  return { ok: true, normalized };
}

export type PasswordError = "empty" | "too-short";

export interface PasswordResult {
  ok: boolean;
  error?: PasswordError;
}

/** Validate a password. Length floor only — no complexity gates
 *  (modern guidance: length beats character classes). */
export function validatePassword(raw: string): PasswordResult {
  if (!raw) return { ok: false, error: "empty" };
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: "too-short" };
  }
  return { ok: true };
}

/** Human-readable copy for sign-up + sign-in form pills. */
export const USERNAME_ERROR_COPY: Record<UsernameError, string> = {
  empty: "Username is required",
  "too-short": `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
  "too-long": `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
  "invalid-chars":
    "Username can only use lowercase letters, digits, _ and -",
  "must-start-with-alnum":
    "Username must start with a letter or digit",
  reserved: "That username is reserved",
};

export const PASSWORD_ERROR_COPY: Record<PasswordError, string> = {
  empty: "Password is required",
  "too-short": `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
};
