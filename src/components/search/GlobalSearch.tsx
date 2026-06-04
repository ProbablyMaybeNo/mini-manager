"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

import type { Paint } from "@/lib/paints/types";
import type { WishlistItem } from "@/db/schema";
import { loadPaints } from "@/lib/paints/loader";
import { runGlobalSearch } from "@/lib/search";
import { useDensity } from "@/lib/hooks/useDensity";

interface FlatHit {
  kind: "paint" | "wishlist" | "command";
  id: string;
  primary: string;
  secondary?: string;
  /** Navigation target — present on nav commands + paint/wishlist hits. */
  href?: string;
  /** Local action — present on action commands (e.g. toggle density). */
  run?: () => void;
  /** D4 — inline keyboard shortcut shown as <kbd> in the row. */
  shortcut?: string;
}

/** D4 — a command in the palette's Commands section. */
interface Command {
  id: string;
  label: string;
  keywords: string;
  href?: string;
  run?: () => void;
  shortcut?: string;
}

/**
 * D4 — command palette + keyboard layer (was the global search).
 *
 * Opens on **Cmd/Ctrl+K** (the universal binding) and keeps `/` as an
 * alias [D §5]. Mounted once in the root layout. Beyond the paint +
 * wishlist hits it now surfaces a **Commands** section — navigation
 * (Projects / Planner / Library / Recipes / Tools / Wishlist) + actions
 * (New project, Toggle density) — each with its inline `<kbd>` shortcut.
 * A visible NavRail trigger (D4) and the M2 mobile tap bridge both open
 * the same overlay.
 *
 * Keyboard layer [D §5]:
 *   - Cmd/Ctrl+K / `/`  → open the palette.
 *   - Ctrl+F            → open the palette (focus the universal search).
 *   - Ctrl+Z            → dispatch the `mm:undo` event (the undo handler
 *                         lands with D5's stage-undo store; the binding is
 *                         wired here so the keyboard layer is complete).
 *
 * M2 — also opened by tap on touch via the `mm:open-search` window event.
 */
export const OPEN_SEARCH_EVENT = "mm:open-search";
export const UNDO_EVENT = "mm:undo";
export function GlobalSearch() {
  const router = useRouter();
  const [density, setDensity] = useDensity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [wishlist, setWishlist] = useState<ReadonlyArray<WishlistItem>>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // D4 — open on Cmd/Ctrl+K (universal) + `/` (alias) when not typing in a
  // field; Ctrl+F focuses the universal search; Ctrl+Z fires the undo
  // event. Escape closes.
  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      return (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      // Cmd/Ctrl+K — the headline binding. Works even while typing.
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // Ctrl+F — focus the active list's search (the universal palette).
      if (mod && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // Ctrl+Z — undo last change (D5's stage-undo store handles it).
      if (mod && (e.key === "z" || e.key === "Z") && !isTypingTarget(e.target)) {
        window.dispatchEvent(new Event(UNDO_EVENT));
        return;
      }
      // `/` alias — only when not typing in a field.
      if (e.key !== "/") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // M7 — Back-dismiss: Android/browser Back closes the open palette rather
  // than navigating away [MOBILE §M7 step 3]. Pairs with the visible Close
  // (×) + Escape + click-outside so dismissal is never gesture-only.
  useEffect(() => {
    if (!open) return;
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  // D4 — the Commands section. Navigation + a couple of high-value
  // actions, each with its inline shortcut where one exists.
  const commands = useMemo<ReadonlyArray<Command>>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      setQuery("");
      router.push(href);
    };
    return [
      { id: "go-projects", label: "Go to Projects", keywords: "projects armies", href: "/projects", run: go("/projects") },
      { id: "go-planner", label: "Go to Planner", keywords: "planner dashboard calendar streak", href: "/planner", run: go("/planner") },
      { id: "go-library", label: "Go to Library", keywords: "library paints catalog", href: "/library", run: go("/library") },
      { id: "go-recipes", label: "Go to Recipes", keywords: "recipes schemes", href: "/recipes", run: go("/recipes") },
      { id: "go-tools", label: "Go to Tools", keywords: "tools wheel match", href: "/tools", run: go("/tools") },
      { id: "go-wishlist", label: "Go to Wishlist", keywords: "wishlist shopping", href: "/wishlist", run: go("/wishlist") },
      { id: "new-project", label: "New project", keywords: "create add project army", href: "/projects/new", run: go("/projects/new") },
      {
        id: "toggle-density",
        label: `Toggle density (now ${density === "compact" ? "Compact" : "Comfortable"})`,
        keywords: "density compact comfortable rows",
        run: () => setDensity(density === "compact" ? "comfortable" : "compact"),
      },
    ];
  }, [router, density, setDensity]);

  // M2 — tap-to-open bridge. The mobile header search button + the
  // Library trigger dispatch `mm:open-search` so the overlay is reachable
  // by touch (where `/` and ⌘K can't be pressed).
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
  }, []);

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

  // D4 — commands matching the query (or all of them when the query is
  // empty so the palette is discoverable on first open). Listed first so
  // navigation + actions are the fastest path.
  const matchedCommands = useMemo<ReadonlyArray<Command>>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const flat: FlatHit[] = useMemo(() => {
    const out: FlatHit[] = [];
    for (const cmd of matchedCommands) {
      out.push({
        kind: "command",
        id: cmd.id,
        primary: cmd.label,
        href: cmd.href,
        run: cmd.run,
        shortcut: cmd.shortcut,
      });
    }
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
  }, [results, matchedCommands]);

  useEffect(() => setHighlight(0), [query]);

  function activate(idx: number) {
    const hit = flat[idx];
    if (!hit) return;
    // Command rows with a local action run it; everything else navigates.
    if (hit.run) {
      hit.run();
      return;
    }
    setOpen(false);
    setQuery("");
    if (hit.href) router.push(hit.href);
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
      aria-label="Command palette — search paints, wishlist, and commands"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl bg-[var(--color-bg-panel)] frame-strong shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
          {/* D4 — the open binding shown as <kbd>. Cmd/Ctrl+K is the
              headline; `/` remains an alias. */}
          <kbd
            aria-hidden
            className="font-mono text-2xs text-[var(--color-fg-muted)] px-1 py-0.5 frame"
          >
            ⌘K
          </kbd>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search paints, wishlist, or run a command…"
            className="flex-1 min-w-0 px-2 py-1 bg-transparent font-mono text-sm focus:outline-none"
          />
          <kbd
            aria-hidden
            className="hidden sm:inline font-mono text-2xs text-[var(--color-fg-subtle)]"
          >
            esc
          </kbd>
          {/* M7 — visible Close (×) so dismissal isn't keyboard/gesture-only
              [MOBILE §M7 step 3]; focus-visible ring on the new control. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
            className="tap-target inline-flex items-center justify-center text-sm font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded-sm px-1"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && paints.length === 0 && flat.length === 0 ? (
            <p className="p-4 text-sm font-mono text-[var(--color-fg-muted)]">
              Loading catalog…
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
  // Cursor walks `flat` in its exact order — commands first, then paints,
  // then wishlist — so the keyboard highlight index stays aligned.
  let cursor = 0;
  const commandHits = flat.filter((h) => h.kind === "command");
  const paintHits = flat.filter((h) => h.kind === "paint");
  const wishlistHits = flat.filter((h) => h.kind === "wishlist");

  return (
    <div className="py-1">
      {commandHits.length > 0 ? (
        <Section title={`Commands · ${commandHits.length}`}>
          {commandHits.map((hit) => {
            const idx = cursor++;
            return (
              <ResultRow
                key={`c-${hit.id}`}
                hit={hit}
                active={idx === highlight}
                onClick={() => activate(idx)}
              />
            );
          })}
        </Section>
      ) : null}
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
      {hit.shortcut ? (
        <kbd
          aria-hidden
          className="shrink-0 font-mono text-2xs text-[var(--color-fg-muted)] px-1 py-0.5 frame"
        >
          {hit.shortcut}
        </kbd>
      ) : hit.secondary ? (
        <span className="text-[var(--color-fg-muted)] truncate text-2xs">
          {hit.secondary}
        </span>
      ) : null}
    </button>
  );
}
