import type { Metadata } from "next";
import type { ReactNode } from "react";

// The sign-in screen (and its /reset child) carry no organic value and would
// only dilute crawl budget — keep them out of the index. The page itself is a
// client component, so the noindex directive lives here in a metadata-only
// layout (C2).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
