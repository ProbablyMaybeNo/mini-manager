"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validatePassword, PASSWORD_ERROR_COPY } from "@/lib/auth/validation";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; message: string };

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(1, "New password is required"),
    confirmPassword: z.string().min(1, "Confirmation is required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation don't match",
    path: ["confirmPassword"],
  });

/**
 * P12.18 — Change-password server action for /user.
 *
 * Validates the new password against the same strength rules
 * sign-up uses. Verifies the current password with bcryptjs +
 * writes the new hash. Errors return inline so the form can render
 * them without a redirect.
 */
export async function changePasswordAction(
  raw: z.infer<typeof schema>,
): Promise<ChangePasswordResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  // Apply the locked password-strength rules. validatePassword
  // returns an `error` key which we map to user-facing copy via
  // PASSWORD_ERROR_COPY.
  const strengthCheck = validatePassword(newPassword);
  if (!strengthCheck.ok) {
    return {
      ok: false,
      message: strengthCheck.error
        ? PASSWORD_ERROR_COPY[strengthCheck.error]
        : "Password is invalid",
    };
  }

  const userId = await currentUserId();
  const row = await db
    .select({
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const existing = row[0];
  if (!existing || !existing.passwordHash) {
    return {
      ok: false,
      message:
        "This account has no password set. Use the password-reset flow to set one.",
    };
  }

  const currentOk = await verifyPassword(currentPassword, existing.passwordHash);
  if (!currentOk) {
    return { ok: false, message: "Current password is incorrect." };
  }

  // Reject no-op changes — the painter probably mistyped.
  if (currentPassword === newPassword) {
    return {
      ok: false,
      message: "New password must be different from the current one.",
    };
  }

  const nextHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: nextHash })
    .where(eq(users.id, userId));

  return { ok: true };
}
