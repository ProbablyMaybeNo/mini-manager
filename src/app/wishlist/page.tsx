import "server-only";

import { currentUserId } from "@/lib/auth-stub";
import {
  listWishlist,
  wishlistTotals,
  listWishlistVendors,
} from "@/db/queries/wishlist";
import { listAllProjects } from "@/db/queries/projects";
import {
  wishlistCategories,
  wishlistStatuses,
  type WishlistCategory,
  type WishlistStatus,
} from "@/db/schema";

import { QuickAddBar } from "@/components/wishlist/QuickAddBar";
import { WishlistFilters } from "@/components/wishlist/WishlistFilters";
import { WishlistTable } from "@/components/wishlist/WishlistTable";
import { PriceFooter } from "@/components/wishlist/PriceFooter";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | string[] | undefined): WishlistStatus | "All" {
  const v = typeof raw === "string" ? raw : null;
  if (v === "All") return "All";
  if (v && (wishlistStatuses as readonly string[]).includes(v)) {
    return v as WishlistStatus;
  }
  return "WISHLIST";
}

function parseCategory(raw: string | string[] | undefined): WishlistCategory | null {
  const v = typeof raw === "string" ? raw : null;
  if (v && (wishlistCategories as readonly string[]).includes(v)) {
    return v as WishlistCategory;
  }
  return null;
}

/**
 * P12.12 — Wishlist split into two stacked tables.
 *
 * Ross's locked layout: Models table at the top, Paints table below.
 * Each renders the same column set the existing WishlistTable
 * supports (we get the partition by filtering items by `kind` —
 * which P12.11 added to the schema). Status filter applies to both
 * tables; the painter sees their full wishlist in one scroll.
 *
 * The slide-out detail drawer (WishlistDetailDrawer) is gone per
 * Ross's brief — inline editing only.
 */
export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  const params = await searchParams;

  const status = parseStatus(params.status);
  const category = parseCategory(params.category);
  const vendor = typeof params.vendor === "string" ? params.vendor : null;

  const [items, totals, vendors, projects] = await Promise.all([
    listWishlist(userId, { status, category, vendor }),
    wishlistTotals(userId, status),
    listWishlistVendors(userId),
    listAllProjects(userId),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    count: p.count,
    ownedCount: p.ownedCount,
    parentId: p.parentId,
  }));

  const hasActiveFilters =
    status !== "WISHLIST" || category !== null || vendor !== null;

  // P12.12 partition by kind. The kind column was added in P12.11 with
  // a heuristic backfill, so pre-Phase-12 rows already have a sensible
  // default ('paint' unless their title looks like a kit / box / etc).
  const modelItems = items.filter((i) => i.kind === "model");
  const paintItems = items.filter((i) => i.kind === "paint");

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 md:px-8 pt-6 pb-4 border-b border-[var(--color-border)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl tracking-wide">WISHLIST</h1>
            <p className="text-xs text-[var(--color-fg-muted)] mt-2 font-sans leading-snug">
              Paints and models you want to buy. Paste a vendor URL to
              auto-fill the row, or type a name for a manual entry.
              Each row gets sorted into Models or Paints automatically.
            </p>
          </div>
          <QuickAddBar />
        </div>
        {/* D7 — on mobile the filters live in the header disclosure (the
            component renders its own Filters trigger < lg). On desktop they
            move to the persistent left rail below, so hide the header copy
            there. */}
        <div className="lg:hidden mt-4">
          <WishlistFilters
            status={status}
            category={category}
            vendors={vendors}
            selectedVendor={vendor}
          />
        </div>
      </header>

      {/* D7 — desktop two-column: persistent left filter rail + the tables
          on the right. Below lg it collapses to a single column (the rail
          is hidden; the header disclosure covers filtering). */}
      <div className="flex-1 min-h-0 flex">
        <aside className="hidden lg:block w-[220px] shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-4">
          <h2 className="section-title mb-3">Filters</h2>
          <WishlistFilters
            status={status}
            category={category}
            vendors={vendors}
            selectedVendor={vendor}
            layout="rail"
          />
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-8">
          <section aria-label="Models" className="space-y-2">
            <h2 className="section-title">Models · {modelItems.length}</h2>
            {modelItems.length === 0 ? (
              <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
                No model rows match. Add a kit, box, or unit from a vendor URL
                and it&apos;ll land here.
              </p>
            ) : (
              <WishlistTable
                items={modelItems}
                projects={projectOptions}
                hasActiveFilters={hasActiveFilters}
              />
            )}
          </section>

          <section aria-label="Paints" className="space-y-2">
            <h2 className="section-title">Paints · {paintItems.length}</h2>
            {paintItems.length === 0 ? (
              <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
                No paint rows match. Match a hex with the Match tool and add
                it to your wishlist to see it here.
              </p>
            ) : (
              <WishlistTable
                items={paintItems}
                projects={projectOptions}
                hasActiveFilters={hasActiveFilters}
                showTools
              />
            )}
          </section>
        </main>
      </div>

      <PriceFooter count={totals.count} totalByCurrency={totals.totalByCurrency} />
    </div>
  );
}
