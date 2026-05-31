"use server";

import { redirect } from "next/navigation";
import { signInWithCredentials } from "@/lib/auth/signUp";

export async function signInAction(input: {
  username: string;
  password: string;
  redirectTo?: string;
}): Promise<{ ok: false; message: string } | never> {
  const res = await signInWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  redirect(input.redirectTo ?? "/projects");
}
