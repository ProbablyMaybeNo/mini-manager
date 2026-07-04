"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "cyan" | "green" | "red";

interface ToastState {
  message: string;
  tone: ToastTone;
  /** Bump on every show so re-firing the same message restarts the timer. */
  seq: number;
}

/**
 * Minimal transient confirmation toast — bottom-center, auto-dismisses.
 * `toast(message, tone?)` shows it; `node` is the element the caller
 * renders once. Deliberately tiny: no queue, one message at a time, which
 * is all the app's confirm-and-forget actions (copied, saved, sent) need.
 */
export function useToast(): {
  toast: (message: string, tone?: ToastTone) => void;
  node: ReactNode;
} {
  const [state, setState] = useState<ToastState | null>(null);
  const seqRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string, tone: ToastTone = "cyan") => {
    seqRef.current += 1;
    setState({ message, tone, seq: seqRef.current });
  }, []);

  useEffect(() => {
    if (!state) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 2400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  const toneClass =
    state?.tone === "green"
      ? "border-green text-green shadow-[0_0_24px_rgba(81,253,128,0.2)]"
      : state?.tone === "red"
        ? "border-red text-red shadow-[0_0_24px_rgba(255,66,66,0.2)]"
        : "border-cyan text-cyan-lite shadow-[0_0_24px_rgba(0,210,255,0.2)]";

  return {
    toast,
    node: state ? (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            "border bg-bg px-4 py-2 font-body text-body motion-safe:animate-[content-in_280ms_ease-out]",
            toneClass,
          )}
        >
          ▸ {state.message}
        </div>
      </div>
    ) : null,
  };
}
