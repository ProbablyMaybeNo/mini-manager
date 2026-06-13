"use server";

import { redirect } from "next/navigation";
import {
  signInWithCredentials,
  signUpWithCredentials,
} from "@/lib/auth/signUp";

/** Result the client form reads on failure; success redirects server-side
 *  (so the freshly-minted session cookie rides the navigation response). */
export type AuthResult = { ok: false; message: string };

export async function signInAction(input: {
  username: string;
  password: string;
}): Promise<AuthResult | never> {
  const res = await signInWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) return { ok: false, message: res.message };
  redirect("/dashboard");
}

export async function signUpAction(input: {
  username: string;
  password: string;
}): Promise<AuthResult | never> {
  const res = await signUpWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) return { ok: false, message: res.message };
  redirect("/dashboard");
}
