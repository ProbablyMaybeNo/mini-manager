import type { ReactNode } from "react";

/** Public surface: signed-out, no app chrome. Pages bring their own minimal nav. */
export default function PublicGroupLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
