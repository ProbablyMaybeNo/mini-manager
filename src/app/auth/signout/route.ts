import { redirect } from "next/navigation";
import { destroyCurrentSession } from "@/lib/auth/session";

/**
 * UX-913 — `/auth/signout` used to 404 (leftover NextAuth URL that
 * users could land on via bookmark / old link / browser autocomplete).
 *
 * Both GET and POST tear down the current session and redirect to
 * `/sign-in`. Safe to hit while already signed out — destroyCurrentSession
 * is a no-op when there's no cookie.
 *
 * The first-party signout path remains the SignOutButton on /user
 * (which posts to the signOutAction server action). This handler is
 * the safety net for direct nav.
 */
export async function GET(): Promise<never> {
  await destroyCurrentSession();
  redirect("/sign-in");
}

export async function POST(): Promise<never> {
  await destroyCurrentSession();
  redirect("/sign-in");
}
