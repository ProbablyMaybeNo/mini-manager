"use server";

import { requestPasswordReset } from "@/lib/auth/passwordReset";

export async function requestPasswordResetAction(input: {
  username: string;
}): Promise<{ ok: true }> {
  await requestPasswordReset(input);
  // Always ok — enumeration safety.
  return { ok: true };
}
