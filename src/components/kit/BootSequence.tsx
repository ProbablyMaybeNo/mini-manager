"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Terminal boot-sequence reveal for the landing hero: lines type on one at a time, with a
 * blinking caret. Guarded by prefers-reduced-motion — reduced users see all lines at once.
 */
export function BootSequence({
  lines,
  lineDelayMs = 450,
  className,
}: {
  lines: string[];
  lineDelayMs?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Defer to a callback so we don't setState synchronously in the effect body.
      const id = setTimeout(() => setVisible(lines.length), 0);
      return () => clearTimeout(id);
    }
    if (visible >= lines.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), lineDelayMs);
    return () => clearTimeout(t);
  }, [visible, lines.length, lineDelayMs]);

  return (
    <div className={cn("font-mono text-xs leading-relaxed text-green", className)} aria-live="polite">
      {lines.slice(0, visible).map((line, i) => (
        <div key={i} className="text-glow-green">
          <span className="text-fg-faint">▸ </span>
          {line}
        </div>
      ))}
      {visible < lines.length && (
        <span className="inline-block h-3 w-2 animate-caret bg-green align-middle" />
      )}
    </div>
  );
}
