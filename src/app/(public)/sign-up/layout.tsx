import type { Metadata } from "next";
import type { ReactNode } from "react";

// The sign-up screen carries no organic value; keep it out of the index. The
// page is a client component, so the noindex directive lives here in a
// metadata-only layout (C2).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
