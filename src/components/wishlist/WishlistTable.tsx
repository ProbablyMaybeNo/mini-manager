"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";

import type { WishlistItem, Priority, ProjectType } from "@/db/schema";
import { TagToProjectMenu } from "./TagToProjectMenu";
import { MarkBoughtModal, type MarkBoughtProjectOption } from "./MarkBoughtModal";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import { AccentCounter } from "@/components/ui/AccentCounter";
import { setWishlistStatus } from "@/lib/actions/wishlist";

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
  Wanted: "wishlist",
  Bought: "ok",
  Cancelled: "neutral",
};

export function WishlistTable({
  items,
  projects,
  hasActiveFilters = false,
}: {
  items: ReadonlyArray<WishlistItem>;
  projects: ReadonlyArray<WishlistTableProjectOption>;
  hasActiveFilters?: boolean;
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
        {!hasActiveFilters ? <AccentCounter value="04" /> : null}
        <p className="text-sm font-mono text-[var(--color-fg-muted)]">
          {hasActiveFilters
            ? "No wishlist items match the current filters."
            : "Nothing on your shopping list yet. Paste a vendor URL above, or type a title to add manually."}
        </p>
      </div>
    );
  }

  return (
    <div className="frame">
      <div
        className={clsx(
          "grid items-center gap-3 px-3 py-1.5 border-b border-[var(--color-border-strong)] section-title m-0 bg-[var(--color-bg-elevated)]",
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
            "grid items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] focus:outline-none focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
            GRID_CLASS,
          )}
        >
          <Thumbnail item={item} />
          <div className="min-w-0">
            <p className="font-mono text-sm truncate text-[var(--color-fg)]">
              {item.title}
            </p>
            {item.sourceUrl ? (
              <p className="text-2xs font-mono text-[var(--color-fg-subtle)] truncate">
                {item.sourceUrl}
              </p>
            ) : null}
          </div>
          <span className="hidden md:inline text-xs font-mono text-[var(--color-fg-muted)] truncate">
            {item.vendor ?? "—"}
          </span>
          <span className="text-xs font-mono text-right text-[var(--color-fg)]">
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
            className={clsx("inline-block h-2.5 w-2.5 rounded-full", PRIORITY_DOT[item.priority])}
            title={`Priority ${item.priority}`}
          />
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <StatusChangePopover
              item={item}
              onMarkBought={() => setBoughtFor(item)}
            />
          </span>
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
 * Mobile collapses the table to thumb / title / price / priority / status —
 * the hidden md: columns (Vendor, Category, Project) drop to 0 because the
 * spans above also have `hidden md:inline`. Desktop restores all eight cols.
 */
const GRID_CLASS =
  "grid-cols-[40px_minmax(0,2fr)_70px_14px_56px] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_90px_90px_110px_14px_80px]";

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

  // Bought is terminal from the table — no menu, just the static pill.
  if (item.status === "Bought") {
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
          className={item.status === "Cancelled" ? "line-through" : undefined}
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
          {item.status === "Wanted" ? (
            <>
              <MenuItem
                onSelect={() => {
                  setOpen(false);
                  onMarkBought();
                }}
                tone="ok"
              >
                ✓ Mark bought
              </MenuItem>
              <MenuItem onSelect={() => setStatus("Cancelled")} tone="muted">
                × Cancel
              </MenuItem>
            </>
          ) : null}
          {item.status === "Cancelled" ? (
            <MenuItem onSelect={() => setStatus("Wanted")} tone="wishlist">
              ↻ Restore to wanted
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
        "w-full text-left px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
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
