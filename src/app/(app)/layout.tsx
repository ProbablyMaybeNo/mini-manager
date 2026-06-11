import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { AppDataProvider } from "@/mock/MockProvider";
import { currentUserId } from "@/lib/auth-stub";
import { loadAppData } from "@/lib/viewmodel/loadAppData";

/**
 * Signed-in surface. `currentUserId()` enforces auth (redirects to /sign-in or
 * /finish-account); `loadAppData` assembles the real view-model from the DB and
 * the paint catalog hydrates client-side inside AppDataProvider.
 */
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const userId = await currentUserId();
  const server = await loadAppData(userId);

  return (
    <AppDataProvider server={server}>
      <AppShell signedIn>{children}</AppShell>
    </AppDataProvider>
  );
}
