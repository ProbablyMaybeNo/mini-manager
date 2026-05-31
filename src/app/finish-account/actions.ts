"use server";

import { finishAccount } from "@/lib/auth/finishAccount";

export async function finishAccountAction(input: {
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await finishAccount(input);
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, message: res.message };
}
