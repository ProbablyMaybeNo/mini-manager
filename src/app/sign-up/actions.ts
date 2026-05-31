"use server";

import { signUpWithCredentials } from "@/lib/auth/signUp";

export async function signUpAction(input: {
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await signUpWithCredentials(input);
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, message: res.message };
}
