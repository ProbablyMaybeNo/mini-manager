"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import {
  wishlistCategories,
  type WishlistCategory,
  type WishlistStatus,
} from "@/db/schema";
import { FilterChip } from "@/components/ui/FilterChip";

const STATUS_OPTIONS: ReadonlyArray<{ value: WishlistStatus | "All"; label: string }> = [
  { value: "WISHLIST", label: "Wishlist" },
  { value: "PURCHASED", label: "Purchased" },
  { value: "HOLD", label: "Hold" },
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
        <FilterChip
          key={opt.value}
          active={status === opt.value}
          onClick={() => setParam("status", opt.value === "WISHLIST" ? null : opt.value)}
        >
          {opt.label}
        </FilterChip>
      ))}

      <span className="mx-2 h-4 w-px bg-[var(--color-border)]" aria-hidden />

      <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] mr-1">
        Category
      </span>
      <FilterChip
        active={category === null}
        onClick={() => setParam("category", null)}
      >
        Any
      </FilterChip>
      {wishlistCategories.map((c) => (
        <FilterChip
          key={c}
          active={category === c}
          onClick={() => setParam("category", category === c ? null : c)}
        >
          {c}
        </FilterChip>
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

