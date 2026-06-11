import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { MockProvider } from "@/mock/MockProvider";

/** Signed-in surface: mock data + full app chrome (rail / top bar). */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <MockProvider variant="populated" signedIn>
      <AppShell signedIn>{children}</AppShell>
    </MockProvider>
  );
}
