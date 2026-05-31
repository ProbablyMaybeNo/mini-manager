"use server";

import { redirect } from "next/navigation";
import { signUpWithCredentials } from "@/lib/auth/signUp";

export async function signUpAction(input: {
  username: string;
  password: string;
  redirectTo?: string;
}): Promise<{ ok: false; message: string } | never> {
  const res = await signUpWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  // Server-side redirect inside the action ensures the freshly-set
  // session cookie travels with the navigation response — the next
  // request the browser makes is authenticated.
  redirect(input.redirectTo ?? "/projects");
}
