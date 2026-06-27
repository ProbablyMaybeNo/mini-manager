"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Re-keys on route change so each page settles in with a brief fade + small
 *  rise (the content-in keyframe). A4 motion reduction: shortened 280ms ->
 *  180ms so route changes feel quick, not animated. Reduced-motion users get
 *  the end state instantly. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="h-full motion-safe:animate-[content-in_180ms_ease-out]">
      {children}
    </div>
  );
}
