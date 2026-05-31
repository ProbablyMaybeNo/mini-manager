"use server";

import { signInWithCredentials } from "@/lib/auth/signUp";

export async function signInAction(input: {
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await signInWithCredentials(input);
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, message: res.message };
}
