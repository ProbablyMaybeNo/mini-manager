"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { WishlistItem, Priority, ProjectType } from "@/db/schema";
import { TagToProjectMenu } from "./TagToProjectMenu";
import { MarkBoughtModal, type MarkBoughtProjectOption } from "./MarkBoughtModal";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { setWishlistStatus } from "@/lib/actions/wishlist";
import { WishlistToolsMenu } from "./WishlistToolsMenu";

export interface WishlistTableProjectOption {
  id: string;
  name: string;
  type: ProjectType;
  count: number;
  ownedCount: number;
  parentId: string | null;
}

const PRIORITY_DOT: Record<Priority, string> = {
  Urgent: "bg-[var(--color-red)]",
  High: "bg-[var(--color-amber)]",
  Medium: "bg-[var(--color-cyan-dim)]",
  Low: "bg-[var(--color-fg-subtle)]",
};

const STATUS_PILL: Record<WishlistItem["status"], StatusPillKind> = {
  WISHLIST: "wishlist",
  PURCHASED: "ok",
  HOLD: "neutral",
};

export function WishlistTable({
  items,
  projects,
  hasActiveFilters = false,
  showTools = false,
}: {
  items: ReadonlyArray<WishlistItem>;
  projects: ReadonlyArray<WishlistTableProjectOption>;
  hasActiveFilters?: boolean;
  /** P12.13 — when true, each row gets a "Tools ▾" menu (Wheel /
   *  Match / Layering) pre-loaded with the paint's title. The
   *  /wishlist page passes true for the paints section only. */
  showTools?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [boughtFor, setBoughtFor] = useState<WishlistItem | null>(null);

  function openItem(id: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("item", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const modalProjects: MarkBoughtProjectOption[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    count: p.count,
    ownedCount: p.ownedCount,
    parentId: p.parentId,
  }));

  if (items.length === 0) {
    return (
      <div className="relative frame p-8 text-center overflow-hidden">
        <p className="text-sm font-mono text-[var(--color-fg-muted)]">
          {hasActiveFilters
            ? "No wishlist items match the current filters."
            : "Nothing on your wishlist yet. Paste a vendor URL above, or type a title to add manually."}
        </p>
      </div>
    );
  }

  return (
    <div className="frame">
      {/* UX-1304 — the column header only makes sense for the dense
          desktop table; the mobile card layout is self-labelling, so
          hide the header strip below md. */}
      <div
        className={clsx(
          "hidden md:grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
          GRID_CLASS,
        )}
      >
        <span aria-hidden />
        <span>Title</span>
        <span className="hidden md:inline">Vendor</span>
        <span className="text-right">Price</span>
        <span className="hidden md:inline">Category</span>
        <span className="hidden md:inline">Project</span>
        <span aria-label="Priority" title="Priority">P</span>
        <span>Status</span>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="row"
          tabIndex={0}
          onClick={() => openItem(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openItem(item.id);
            }
          }}
          className={clsx(
            "caret-row",
            // UX-1304 — below md the row is a stacked card so the STATUS
            // / OPEN-IN controls never clip off the right edge of a phone.
            // At md+ it restores the dense multi-column grid.
            "flex flex-col gap-2 md:grid md:items-center md:gap-3 px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
            GRID_CLASS,
          )}
        >
          {/* Mobile: title row (thumb + title own a full line). Desktop:
              the thumb and title are the first two grid cells. */}
          <div className="flex items-center gap-3 min-w-0 md:contents">
            <Thumbnail item={item} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm truncate text-[var(--color-fg)]">
                {item.title}
              </p>
              {item.sourceUrl ? (
                <p className="text-2xs font-mono text-[var(--color-fg-subtle)] truncate">
                  {item.sourceUrl}
                </p>
              ) : null}
            </div>
            {/* Priority dot rides the title line on mobile; on desktop it
                jumps to its own grid cell via md:hidden / md:inline-block. */}
            <span
              className={clsx(
                "inline-block h-2.5 w-2.5 rounded-full shrink-0 md:hidden",
                PRIORITY_DOT[item.priority],
              )}
              title={`Priority ${item.priority}`}
            />
          </div>
          <span className="hidden md:inline text-xs font-mono text-[var(--color-fg-muted)] truncate">
            {item.vendor ?? "—"}
          </span>
          {/* Mobile second line: price + status (+ tools) wrap cleanly. */}
          <div className="flex flex-wrap items-center gap-3 md:contents">
            <span className="text-xs font-mono text-[var(--color-fg)] md:text-right">
              {formatPrice(item.price, item.currency)}
            </span>
            <span className="hidden md:inline text-xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wide">
              {item.category}
            </span>
            <span className="hidden md:inline">
              <TagToProjectMenu
                itemId={item.id}
                current={item.projectId}
                projects={projects}
              />
            </span>
            <span
              className={clsx(
                "hidden md:inline-block h-2.5 w-2.5 rounded-full",
                PRIORITY_DOT[item.priority],
              )}
              title={`Priority ${item.priority}`}
            />
            <span
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 ml-auto md:ml-0"
            >
              {showTools ? (
                <WishlistToolsMenu paintTitle={item.title} />
              ) : null}
              <StatusChangePopover
                item={item}
                onMarkBought={() => setBoughtFor(item)}
              />
            </span>
          </div>
        </div>
      ))}
      {boughtFor ? (
        <MarkBoughtModal
          open
          onClose={() => setBoughtFor(null)}
          itemId={boughtFor.id}
          title={boughtFor.title}
          projects={modalProjects}
        />
      ) : null}
    </div>
  );
}

/**
 * UX-1304 — mobile is now a stacked CARD (flex-col), so only the desktop
 * grid template matters here. At md+ the eight columns restore: thumb /
 * title / vendor / price / category / project / priority / status.
 *
 * Wider status column on desktop (140px) so the WishlistToolsMenu +
 * StatusChangePopover both fit without spilling past the table border
 * (Ross's Round-7 feedback). Title column shrinks slightly with
 * `minmax(0,1.6fr)` so the total row still fits 1024px viewports without
 * horizontal scroll.
 */
const GRID_CLASS =
  "md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1fr)_80px_90px_110px_14px_140px]";

function Thumbnail({ item }: { item: WishlistItem }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-10 w-10 rounded-sm object-cover border border-[var(--color-border)]"
        loading="lazy"
      />
    );
  }
  const initial = (item.title[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="h-10 w-10 rounded-sm border border-[var(--color-border)] inline-flex items-center justify-center font-mono text-base text-[var(--color-fg-muted)]"
    >
      {initial}
    </span>
  );
}

/**
 * Inline status pill that doubles as a popover trigger. NB-8 — was a
 * single forward arrow that only worked for Wanted → Bought (via the
 * MarkBoughtModal). Now any row can transition between statuses without
 * opening the side drawer: click the pill → small menu lists the valid
 * destinations for the current state.
 *
 * - From Wanted: → Mark bought (full modal flow), → Cancel
 * - From Cancelled: → Restore (back to Wanted)
 * - From Bought: pill is a static badge (terminal state from the table;
 *   un-bought is a destructive op that lives in the detail drawer's
 *   Save → status select to discourage accidental fires).
 */
function StatusChangePopover({
  item,
  onMarkBought,
}: {
  item: WishlistItem;
  onMarkBought: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setStatus = (next: WishlistItem["status"]) => {
    setOpen(false);
    startTransition(async () => {
      await setWishlistStatus({ id: item.id, status: next });
    });
  };

  // PURCHASED is terminal from the table — no menu, just the static pill.
  if (item.status === "PURCHASED") {
    return <StatusPill status={STATUS_PILL[item.status]}>{item.status}</StatusPill>;
  }

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change status"
        className="inline-flex items-center"
      >
        <StatusPill
          status={STATUS_PILL[item.status]}
          className={item.status === "HOLD" ? "line-through" : undefined}
        >
          {item.status} ▾
        </StatusPill>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Change status"
          className="absolute right-0 top-full mt-1 z-30 min-w-[140px] frame-strong bg-[var(--color-bg-panel)] shadow-xl py-1"
        >
          {item.status === "WISHLIST" ? (
            <>
              <MenuItem
                onSelect={() => {
                  setOpen(false);
                  onMarkBought();
                }}
                tone="ok"
              >
                ✓ Mark purchased
              </MenuItem>
              <MenuItem onSelect={() => setStatus("HOLD")} tone="muted">
                · Move to hold
              </MenuItem>
            </>
          ) : null}
          {item.status === "HOLD" ? (
            <MenuItem onSelect={() => setStatus("WISHLIST")} tone="wishlist">
              ↻ Restore to wishlist
            </MenuItem>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

function MenuItem({
  onSelect,
  tone,
  children,
}: {
  onSelect: () => void;
  tone: "ok" | "muted" | "wishlist";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "ok"
      ? "text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
      : tone === "wishlist"
        ? "text-[var(--color-yellow)] hover:bg-[color-mix(in_srgb,var(--color-yellow)_10%,transparent)]"
        : "text-[var(--color-fg-muted)] hover:bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)] hover:text-[var(--color-fg)]";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={clsx(
        // UX-1308 — the per-row status actions (Mark purchased / Move to
        // hold / Restore) floor to a 44px touch target via tap-target.
        "tap-target w-full text-left px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center",
        toneClass,
      )}
    >
      {children}
    </button>
  );
}

function formatPrice(priceCents: number | null, currency: string | null): string {
  if (priceCents === null || priceCents === undefined) return "—";
  const dollars = priceCents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
      dollars,
    );
  } catch {
    return `${dollars.toFixed(2)} ${code}`;
  }
}
