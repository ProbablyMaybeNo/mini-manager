"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import type { WishlistItem } from "@/db/schema";
import { loadPaints } from "@/lib/paints/loader";
import { runGlobalSearch } from "@/lib/search";

interface FlatHit {
  kind: "paint" | "wishlist";
  id: string;
  primary: string;
  secondary?: string;
  href: string;
}

/**
 * Cmd/Ctrl+K-class global search, bound to `/`. Mounted once in the
 * root layout. Paints come from the Dexie loader; wishlist from a tiny
 * route handler. Both populate on first open — there's no point paying
 * for them on every page load.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [wishlist, setWishlist] = useState<ReadonlyArray<WishlistItem>>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // `/` to open (when not typing in something else).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (e.key !== "/") return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input each time the popover opens; lazy-load data once.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (paints.length === 0 && !loading) {
      setLoading(true);
      Promise.all([
        loadPaints(),
        fetch("/api/wishlist/list").then((r) =>
          r.ok ? (r.json() as Promise<WishlistItem[]>) : [],
        ),
      ])
        .then(([p, w]) => {
          setPaints(p);
          setWishlist(w);
        })
        .catch(() => {
          // Network blip — let the user retry by closing+reopening.
        })
        .finally(() => setLoading(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(
    () => runGlobalSearch(query, paints, wishlist),
    [query, paints, wishlist],
  );

  const flat: FlatHit[] = useMemo(() => {
    const out: FlatHit[] = [];
    for (const hit of results.paints) {
      out.push({
        kind: "paint",
        id: hit.item.id,
        primary: hit.item.name,
        secondary: `${hit.item.brand}${hit.item.line ? ` · ${hit.item.line}` : ""}`,
        href: `/library?paint=${encodeURIComponent(hit.item.id)}`,
      });
    }
    for (const hit of results.wishlist) {
      out.push({
        kind: "wishlist",
        id: hit.item.id,
        primary: hit.item.title,
        secondary: hit.item.vendor ?? "—",
        href: `/wishlist?item=${encodeURIComponent(hit.item.id)}`,
      });
    }
    return out;
  }, [results]);

  useEffect(() => setHighlight(0), [query]);

  function activate(idx: number) {
    const hit = flat[idx];
    if (!hit) return;
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(flat.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(highlight);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search paints and wishlist"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl bg-[var(--color-bg-panel)] frame-strong shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
          <span aria-hidden className="font-mono text-2xs text-[var(--color-fg-muted)]">
            [ / ]
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search paints and wishlist…"
            className="flex-1 min-w-0 px-2 py-1 bg-transparent font-mono text-sm focus:outline-none"
          />
          <span className="text-2xs font-mono text-[var(--color-fg-subtle)]">esc</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && paints.length === 0 ? (
            <p className="p-4 text-sm font-mono text-[var(--color-fg-muted)]">
              Loading catalog…
            </p>
          ) : query.length === 0 ? (
            <p className="p-4 text-sm font-mono text-[var(--color-fg-muted)]">
              Type to search across the paint catalog and your wishlist.
            </p>
          ) : flat.length === 0 ? (
            <p className="p-4 text-sm font-mono text-[var(--color-fg-muted)]">
              No matches.
            </p>
          ) : (
            <Sections flat={flat} highlight={highlight} activate={activate} />
          )}
        </div>
      </div>
    </div>
  );
}

function Sections({
  flat,
  highlight,
  activate,
}: {
  flat: FlatHit[];
  highlight: number;
  activate: (idx: number) => void;
}) {
  let cursor = 0;
  const paintHits = flat.filter((h) => h.kind === "paint");
  const wishlistHits = flat.filter((h) => h.kind === "wishlist");

  return (
    <div className="py-1">
      {paintHits.length > 0 ? (
        <Section title={`Paints · ${paintHits.length}`}>
          {paintHits.map((hit) => {
            const idx = cursor++;
            return (
              <ResultRow
                key={`p-${hit.id}`}
                hit={hit}
                active={idx === highlight}
                onClick={() => activate(idx)}
              />
            );
          })}
        </Section>
      ) : null}
      {wishlistHits.length > 0 ? (
        <Section title={`Wishlist · ${wishlistHits.length}`}>
          {wishlistHits.map((hit) => {
            const idx = cursor++;
            return (
              <ResultRow
                key={`w-${hit.id}`}
                hit={hit}
                active={idx === highlight}
                onClick={() => activate(idx)}
              />
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-3 pt-2 pb-1 section-title m-0">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({
  hit,
  active,
  onClick,
}: {
  hit: FlatHit;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full text-left flex items-center justify-between gap-3 px-3 py-1.5",
        "font-mono text-xs",
        active
          ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] text-[var(--color-fg)]",
      )}
    >
      <span className="truncate">{hit.primary}</span>
      <span className="text-[var(--color-fg-muted)] truncate text-2xs">
        {hit.secondary}
      </span>
    </button>
  );
}
