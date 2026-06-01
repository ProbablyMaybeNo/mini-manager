/**
 * UX-909 — Autocomplete attributes on every auth form.
 *
 * Round-9 audit flagged /sign-up password pre-filling with a saved
 * password from another site. The fix locks every auth form's
 * username + password inputs to the correct WHATWG autocomplete
 * token so browsers (and password managers) never confuse a fresh
 * sign-up with a returning sign-in:
 *
 *   /sign-in              username + current-password
 *   /sign-up              username + new-password (twice)
 *   /finish-account       username + new-password
 *   /sign-in/reset        new-password (twice)
 *   /user (change pw)     current-password + new-password (twice)
 *
 * File-level scan, in the same vein as bracketAudit.test.ts — keeps
 * a future refactor from quietly dropping the attribute and
 * resurrecting the bug.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

interface FormSpec {
  file: string;
  /** Number of inputs with autoComplete="username" expected. */
  usernameCount: number;
  /** Number of inputs with autoComplete="new-password" expected. */
  newPasswordCount: number;
  /** Number of inputs with autoComplete="current-password" expected. */
  currentPasswordCount: number;
}

const SPECS: FormSpec[] = [
  {
    file: "src/app/sign-in/SignInForm.tsx",
    usernameCount: 1,
    newPasswordCount: 0,
    currentPasswordCount: 1,
  },
  {
    file: "src/app/sign-up/SignUpForm.tsx",
    usernameCount: 1,
    newPasswordCount: 2,
    currentPasswordCount: 0,
  },
  {
    file: "src/app/finish-account/FinishAccountForm.tsx",
    usernameCount: 1,
    newPasswordCount: 1,
    currentPasswordCount: 0,
  },
  {
    file: "src/app/sign-in/reset/ResetPasswordForm.tsx",
    usernameCount: 0,
    newPasswordCount: 2,
    currentPasswordCount: 0,
  },
  {
    file: "src/components/user/ChangePasswordCard.tsx",
    usernameCount: 0,
    newPasswordCount: 2,
    currentPasswordCount: 1,
  },
];

function countOccurrences(src: string, token: string): number {
  const re = new RegExp(`autoComplete="${token}"`, "g");
  return (src.match(re) ?? []).length;
}

describe("Auth form autocomplete attributes (UX-909)", () => {
  for (const spec of SPECS) {
    describe(spec.file, () => {
      const src = read(spec.file);

      test(`has ${spec.usernameCount} autoComplete="username" input(s)`, () => {
        expect(countOccurrences(src, "username")).toBe(spec.usernameCount);
      });

      test(`has ${spec.newPasswordCount} autoComplete="new-password" input(s)`, () => {
        expect(countOccurrences(src, "new-password")).toBe(
          spec.newPasswordCount,
        );
      });

      test(`has ${spec.currentPasswordCount} autoComplete="current-password" input(s)`, () => {
        expect(countOccurrences(src, "current-password")).toBe(
          spec.currentPasswordCount,
        );
      });
    });
  }
});
