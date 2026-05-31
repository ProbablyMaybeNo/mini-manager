"use server";

import { applyPasswordReset } from "@/lib/auth/passwordReset";

export async function applyPasswordResetAction(input: {
  token: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return applyPasswordReset(input);
}
