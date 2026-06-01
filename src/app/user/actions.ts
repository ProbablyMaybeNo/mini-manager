"use server";

import { redirect } from "next/navigation";
import { destroyCurrentSession } from "@/lib/auth/session";

/**
 * Sign-out action. Tears down the current session (deletes the DB row +
 * clears the __Secure-authjs.session-token cookie) and bounces the
 * caller to /sign-in. Used by the SignOutButton on /user.
 *
 * UX-V6-003 — pre-Round-6 there was no log-out anywhere in the app
 * once a user was signed in. Privacy gap on shared machines + NN/g #3
 * user-control violation.
 */
export async function signOutAction(): Promise<never> {
  await destroyCurrentSession();
  redirect("/sign-in");
}
