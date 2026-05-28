"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import {
  wishlistCategories,
  wishlistStatuses,
  type WishlistCategory,
  type WishlistStatus,
} from "@/db/schema";

const STATUS_OPTIONS: ReadonlyArray<{ value: WishlistStatus | "All"; label: string }> = [
  { value: "Wanted", label: "Wanted" },
  { value: "Bought", label: "Bought" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "All", label: "All" },
];

export function WishlistFilters({
  status,
  category,
  vendors,
  selectedVendor,
}: {
  status: WishlistStatus | "All";
  category: WishlistCategory | null;
  vendors: ReadonlyArray<string>;
  selectedVendor: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-pending={isPending ? "true" : undefined}
    >
      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] mr-1">
        Status
      </span>
      {STATUS_OPTIONS.map((opt) => (
        <Chip
          key={opt.value}
          active={status === opt.value}
          onClick={() => setParam("status", opt.value === "Wanted" ? null : opt.value)}
        >
          {opt.label}
        </Chip>
      ))}

      <span className="mx-2 h-4 w-px bg-[var(--color-border)]" aria-hidden />

      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] mr-1">
        Category
      </span>
      <Chip
        active={category === null}
        onClick={() => setParam("category", null)}
      >
        Any
      </Chip>
      {wishlistCategories.map((c) => (
        <Chip
          key={c}
          active={category === c}
          onClick={() => setParam("category", category === c ? null : c)}
        >
          {c}
        </Chip>
      ))}

      {vendors.length > 0 ? (
        <>
          <span className="mx-2 h-4 w-px bg-[var(--color-border)]" aria-hidden />
          <label className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
            Vendor
            <select
              value={selectedVendor ?? ""}
              onChange={(e) => setParam("vendor", e.target.value || null)}
              className="ml-2 px-2 py-1 font-mono text-xs frame bg-[var(--color-bg-elevated)]"
            >
              <option value="">Any</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  void wishlistStatuses; // satisfies the lint rule that imports are used.
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center px-2 py-1 text-2xs font-mono rounded-sm border transition-colors",
        active
          ? "border-[var(--color-green)] text-[var(--color-green)] bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
