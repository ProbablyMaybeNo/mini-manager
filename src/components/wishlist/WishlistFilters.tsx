"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import {
  wishlistCategories,
  type WishlistCategory,
  type WishlistStatus,
} from "@/db/schema";
import { FilterChip } from "@/components/ui/FilterChip";
import { Button } from "@/components/ui/Button";

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
  // M2 — filter disclosure parity with Library: the STATUS/CATEGORY/
  // VENDOR block is collapsed behind a FILTERS button on mobile so the
  // list is the first thing on screen (it used to eat the whole first
  // viewport). Expanded inline on lg+ where there's room.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Active-filter count for the disclosure badge. Default status
  // (WISHLIST) + no category + no vendor = 0 active.
  const activeCount =
    (status !== "WISHLIST" ? 1 : 0) +
    (category !== null ? 1 : 0) +
    (selectedVendor ? 1 : 0);

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
    <div data-pending={isPending ? "true" : undefined}>
      {/* Mobile disclosure trigger — ghost outline, no cyan fill. */}
      <Button
        type="button"
        variant="ghost"
        tone="outline"
        size="sm"
        className="lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="wishlist-filter-body"
        onClick={() => setMobileOpen((v) => !v)}
      >
        Filters
        {activeCount > 0 ? (
          <span
            className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm bg-[var(--color-amber)] text-[var(--color-bg)] font-mono text-2xs leading-none"
            aria-hidden
          >
            {activeCount}
          </span>
        ) : null}
        <span className="sr-only">
          {activeCount > 0 ? `, ${activeCount} active` : ""}
        </span>
      </Button>

      <div
        id="wishlist-filter-body"
        className={clsx(
          "flex-wrap items-center gap-2 mt-2 lg:mt-0",
          mobileOpen ? "flex" : "hidden",
          "lg:flex",
        )}
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
    </div>
  );
}

