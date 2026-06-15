"use server";

import { redirect } from "next/navigation";
import {
  signInWithCredentials,
  signUpWithCredentials,
} from "@/lib/auth/signUp";

/** Result the client form reads on failure; success redirects server-side
 *  (so the freshly-minted session cookie rides the navigation response). */
export type AuthResult = { ok: false; message: string };

/**
 * Resolve the post-auth destination. Only internal, single-leading-slash
 * paths are honoured (so callers like /pricing can resume an interrupted
 * upgrade by passing `next`); anything else — including protocol-relative
 * `//evil.com` open-redirect attempts — falls back to the dashboard.
 */
function safePostAuthPath(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function signInAction(input: {
  username: string;
  password: string;
  next?: string;
}): Promise<AuthResult | never> {
  const res = await signInWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) return { ok: false, message: res.message };
  redirect(safePostAuthPath(input.next));
}

export async function signUpAction(input: {
  username: string;
  password: string;
  next?: string;
}): Promise<AuthResult | never> {
  const res = await signUpWithCredentials({
    username: input.username,
    password: input.password,
  });
  if (!res.ok) return { ok: false, message: res.message };
  redirect(safePostAuthPath(input.next));
}
