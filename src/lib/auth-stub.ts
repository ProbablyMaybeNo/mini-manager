import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Resolve the current user id from the session. Throws via `redirect`
 * to `/sign-in` if nothing is authenticated — server actions and pages
 * can therefore treat the return value as a guaranteed string.
 *
 * Despite the filename, this is the real auth helper now. P1.3 replaced
 * the stub with the NextAuth session lookup; the filename stays so all
 * existing call sites only need to add `await`.
 */
export async function currentUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    redirect("/sign-in");
  }
  return id;
}
