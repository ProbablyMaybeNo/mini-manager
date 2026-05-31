"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { clsx } from "clsx";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

/* ============================================================
   Types
   ============================================================ */

export type ToastStatus = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  status: ToastStatus;
  message: string;
  description?: string;
  /** ms before auto-dismiss. 0/null = sticky. Defaults differ per status. */
  duration: number | null;
}

interface ToastInput {
  message: string;
  description?: string;
  duration?: number | null;
}

interface ToastContextValue {
  toasts: ReadonlyArray<Toast>;
  push: (status: ToastStatus, input: ToastInput) => string;
  dismiss: (id: string) => void;
}

/* ============================================================
   Reducer
   ============================================================ */

export const MAX_VISIBLE = 5;
export const DEFAULT_DURATIONS: Record<ToastStatus, number | null> = {
  success: 3500,
  info: 3500,
  warning: 5500,
  error: null, // sticky — user dismisses
};

export type ToastAction =
  | { type: "push"; toast: Toast }
  | { type: "dismiss"; id: string };

export function toastReducer(state: ReadonlyArray<Toast>, action: ToastAction): ReadonlyArray<Toast> {
  switch (action.type) {
    case "push": {
      const next = [...state, action.toast];
      // Cap stack — oldest non-error toasts get dropped first.
      if (next.length <= MAX_VISIBLE) return next;
      const overflow = next.length - MAX_VISIBLE;
      const droppable = next.filter((t) => t.status !== "error");
      if (droppable.length >= overflow) {
        const idsToDrop = new Set(droppable.slice(0, overflow).map((t) => t.id));
        return next.filter((t) => !idsToDrop.has(t.id));
      }
      // All stack is errors — drop oldest anyway.
      return next.slice(overflow);
    }
    case "dismiss":
      return state.filter((t) => t.id !== action.id);
  }
}

/* ============================================================
   Context + hook
   ============================================================ */

const ToastContext = createContext<ToastContextValue | null>(null);

function newId(): string {
  // Stable enough — collisions are very unlikely + the cap caps blast radius.
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  const { push, dismiss } = ctx;
  return useMemo(
    () => ({
      success: (input: ToastInput | string) =>
        push("success", typeof input === "string" ? { message: input } : input),
      info: (input: ToastInput | string) =>
        push("info", typeof input === "string" ? { message: input } : input),
      warning: (input: ToastInput | string) =>
        push("warning", typeof input === "string" ? { message: input } : input),
      error: (input: ToastInput | string) =>
        push("error", typeof input === "string" ? { message: input } : input),
      dismiss,
    }),
    [push, dismiss],
  );
}

/* ============================================================
   Provider + viewport
   ============================================================ */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [] as ReadonlyArray<Toast>);

  const push = useCallback<ToastContextValue["push"]>((status, input) => {
    const id = newId();
    const duration =
      input.duration !== undefined ? input.duration : DEFAULT_DURATIONS[status];
    dispatch({
      type: "push",
      toast: {
        id,
        status,
        message: input.message,
        description: input.description,
        duration,
      },
    });
    return id;
  }, []);

  const dismiss = useCallback<ToastContextValue["dismiss"]>((id) => {
    dispatch({ type: "dismiss", id });
  }, []);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ReadonlyArray<Toast>;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className={clsx(
        // z-[60] keeps the stack above side panels (PaintDetailPanel,
        // WishlistDetailDrawer, MarkBoughtModal — all z-50) and the
        // global mobile chrome. Modals that need to outrank a toast
        // must use z-[70]+ themselves.
        "pointer-events-none fixed z-[60]",
        // Top-center on every viewport. Avoids occlusion from the
        // right-side detail panels + the bottom tab bar entirely, and
        // arrives in the user's natural reading scan path.
        "top-3 left-1/2 -translate-x-1/2",
        "flex flex-col gap-2 items-stretch",
        "w-[min(96vw,420px)]",
      )}
      style={{
        top: "max(0.75rem, calc(env(safe-area-inset-top,0px) + 3.5rem))",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const STATUS_ICON = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const STATUS_TONE: Record<ToastStatus, string> = {
  success: "text-[var(--status-ok)] border-[var(--status-ok)]",
  info: "text-[var(--status-info)] border-[var(--status-info)]",
  warning: "text-[var(--status-warning)] border-[var(--status-warning)]",
  error: "text-[var(--status-danger)] border-[var(--status-danger)]",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = STATUS_ICON[toast.status];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.duration == null) return;
    timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.status === "error" ? "alert" : "status"}
      className={clsx(
        "toast-item pointer-events-auto w-full",
        "bg-[var(--color-bg-elevated)]",
        "border-l-2 border-y border-r border-[var(--color-border)]",
        "rounded-sm px-3 py-2.5",
        "flex items-start gap-2.5",
        "shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6),0_2px_4px_-1px_rgba(0,0,0,0.4)]",
        STATUS_TONE[toast.status],
      )}
    >
      <span className="shrink-0 mt-0.5">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-wider leading-snug">
          {toast.message}
        </p>
        {toast.description ? (
          <p className="mt-0.5 font-mono text-2xs text-[var(--color-fg-muted)] normal-case tracking-normal leading-snug">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        <X size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
