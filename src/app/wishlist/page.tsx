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
import { WishlistDetailDrawer } from "@/components/wishlist/WishlistDetailDrawer";

export const dynamic = "force-dynamic";

function parseStatus(raw: string | string[] | undefined): WishlistStatus | "All" {
  const v = typeof raw === "string" ? raw : null;
  if (v === "All") return "All";
  if (v && (wishlistStatuses as readonly string[]).includes(v)) {
    return v as WishlistStatus;
  }
  return "Wanted";
}

function parseCategory(raw: string | string[] | undefined): WishlistCategory | null {
  const v = typeof raw === "string" ? raw : null;
  if (v && (wishlistCategories as readonly string[]).includes(v)) {
    return v as WishlistCategory;
  }
  return null;
}

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
  const selectedItemId = typeof params.item === "string" ? params.item : null;

  const [items, totals, vendors, projects] = await Promise.all([
    listWishlist(userId, { status, category, vendor }),
    wishlistTotals(userId, status),
    listWishlistVendors(userId),
    listAllProjects(userId),
  ]);

  const selected = selectedItemId
    ? items.find((i) => i.id === selectedItemId) ?? null
    : null;

  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    count: p.count,
    ownedCount: p.ownedCount,
    parentId: p.parentId,
  }));

  const hasActiveFilters =
    status !== "Wanted" || category !== null || vendor !== null;

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 md:px-8 pt-6 pb-4 border-b border-[var(--color-border)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl">┌─ WISHLIST ─</h1>
            <p className="text-xs text-[var(--color-fg-muted)] mt-2 font-sans">
              Your shopping list. Manual entries land instantly; vendor URLs
              get scraped in P2.5.
            </p>
          </div>
          <QuickAddBar />
        </div>
        <WishlistFilters
          status={status}
          category={category}
          vendors={vendors}
          selectedVendor={vendor}
        />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
        <WishlistTable items={items} projects={projectOptions} hasActiveFilters={hasActiveFilters} />
      </main>

      <PriceFooter count={totals.count} totalByCurrency={totals.totalByCurrency} />

      <WishlistDetailDrawer item={selected} projects={projectOptions} />
    </div>
  );
}
