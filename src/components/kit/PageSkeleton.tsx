import { cn } from "@/lib/cn";

/** A single pulsing placeholder block. Pure presentational, so it's safe to
 *  render from a server component (route `loading.tsx`). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-fg/[0.07]", className)} aria-hidden />;
}

type Variant = "list" | "cards" | "tool" | "detail";

/**
 * Route-level loading skeleton shown via `loading.tsx` the instant a dynamic
 * page is navigated to, so the content area paints immediately (matching the
 * shell) while the server render + DB reads stream in — instead of a blank
 * gap. Coarse by design: it conveys "content loads here", not a pixel match.
 */
export function PageSkeleton({ variant }: { variant: Variant }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {/* Header bar — title + a right-aligned control, on every route. */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      {variant === "list" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}
      {variant === "cards" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </>
      )}
      {variant === "tool" && (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          <Skeleton className="aspect-square w-full lg:max-w-md" />
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      )}
      {variant === "detail" && (
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
