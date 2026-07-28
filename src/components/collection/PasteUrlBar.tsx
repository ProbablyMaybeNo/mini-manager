"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/components/kit";
import { cn } from "@/lib/cn";
import { useAutoFillBoxCollapsed } from "@/lib/hooks/useAutoFillBoxCollapsed";
import {
  SUPPORTED_STORE_LINKS,
  isSupportedStoreUrl,
} from "@/lib/scrape/stores";
import type { CollectionKind } from "@/lib/types";

const KIND_OPTIONS: { value: CollectionKind; label: string }[] = [
  { value: "paint", label: "Paint" },
  { value: "model", label: "Model" },
];

/**
 * MM-39 paint/model toggle: inactive = no fill, purple border + purple
 * text; active = solid-purple fill with black label. The fill is full
 * opacity (not purple/40) so the black label clears WCAG AA (UX-009 —
 * purple/40 over the near-black canvas measured ~1.05:1). Drives the kind
 * that the scrape add path honours (MM-36).
 */
function KindToggle({
  value,
  onChange,
}: {
  value: CollectionKind;
  onChange: (k: CollectionKind) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Item type" className="inline-flex gap-2">
      {KIND_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[6px] border px-4 py-1.5 font-button text-button uppercase tracking-[0.15em] transition-colors",
              "border-cyan",
              active
                ? "bg-cyan text-bg"
                : "bg-transparent text-cyan-lite hover:bg-cyan/10",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The "how auto-fill works" helper, restyled into the same bordered section box
 * the project page uses (Panel + notched label) and moved above the paste box so
 * it reads right after the page title (Ross, sFAkBUvAcSiF). Open by default with
 * a slide-out toggle; the collapse is persistent per-device via
 * useAutoFillBoxCollapsed. Unlike the project-page sections (mobile-only
 * collapse), the toggle here works on every viewport.
 */
function AutoFillBox() {
  const [collapsed, setCollapsed] = useAutoFillBoxCollapsed();
  return (
    // The auto-fill helper IS the page's blue intro section now (Ross,
    // 2026-07-10): #22568F navy + white text, same treatment as the project /
    // recipes "> SYS" banner, rather than a separate blue bar stacked above a
    // bordered card. Still collapsible on every viewport.
    // Desktop only (Ross, 2026-07-27): on a phone this navy block pushed the
    // actual paste field and the whole table below the fold to explain
    // something the field's own placeholder already says. Nothing here is
    // load-bearing — the supported-store list and the extension teaser are
    // nice-to-have, so phones just get the input.
    <section
      // `roomy:` not `md:` — md is true at 812×375, so rotating a phone on the
      // collection screen put this explainer back and pushed the first paint row
      // to y=625 in a 375px-tall viewport: zero rows of collection visible
      // (MUX3-004).
      className="hidden rounded-[10px] px-4 py-3.5 text-white roomy:block"
      style={{ backgroundColor: "#22568F" }}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="paste-url-stores"
        onClick={() => setCollapsed(!collapsed)}
        className="-mt-1 flex min-h-11 w-full items-center justify-between gap-2 md:min-h-8"
      >
        <span className="font-mono text-[12px] font-bold uppercase tracking-wide text-white">
          TRACKING YOUR COLLECTION MADE EASY
        </span>
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-white transition-transform",
            !collapsed && "rotate-90",
          )}
        >
          ▸
        </span>
      </button>
      <div
        id="paste-url-stores"
        className={cn(collapsed ? "hidden" : "flex", "mt-2 flex-col gap-3")}
      >
        <p className="font-body text-body leading-snug text-white">
          Auto-populate your model and paint collections by pasting a product URL
          from any major online retailer. Auto-fills from:{" "}
          {SUPPORTED_STORE_LINKS.map((store, i) => (
            <span key={store.url}>
              <a
                href={store.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white underline decoration-white/50 underline-offset-2 hover:decoration-white"
              >
                {store.name}
              </a>
              {i < SUPPORTED_STORE_LINKS.length - 1 && ", "}
            </span>
          ))}
          . Other links still add a row — you just enter the details yourself.
        </p>
        <div className="border-t border-white/25 pt-3">
          <p className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wide text-white">
            Browser extension
            <span className="rounded-[4px] border border-white/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-white">
              Coming soon
            </span>
          </p>
          <p className="mt-1.5 font-body text-body leading-snug text-white">
            Skip the copy-paste entirely — a Chrome extension that adds whatever
            product page you&apos;re on to your collection with one keyboard
            shortcut (<span className="font-semibold text-white">Alt+Shift+M</span>) or a click
            of the toolbar button, tagged{" "}
            <span className="font-semibold text-white">Owned</span> or{" "}
            <span className="font-semibold text-white">Wishlist</span> on the spot. Landing on
            the Chrome Web Store soon.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Paste a store URL + choose Paint/Model → emits the URL; the host fetches/auto-fills. */
export function PasteUrlBar({
  onAddUrl,
}: {
  onAddUrl: (url: string, kind: CollectionKind) => void;
}) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<CollectionKind>("paint");

  const trimmed = url.trim();
  // MM-40 — flag a pasted link whose host no parser supports, but only
  // once it looks like a complete URL (don't nag mid-type).
  const unsupported = useMemo(() => {
    if (!trimmed || !/^https?:\/\/\S+\.\S+/i.test(trimmed)) return false;
    return !isSupportedStoreUrl(trimmed);
  }, [trimmed]);

  function submit() {
    if (!trimmed) return;
    onAddUrl(trimmed, kind);
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-3">
      <AutoFillBox />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-end gap-2">
          <KindToggle value={kind} onChange={setKind} />
          <Input
            name="paste-url"
            aria-label="Paste a store URL"
            placeholder="Paste a store URL to fill the table…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            containerClassName="min-w-[260px] flex-1"
            aria-invalid={unsupported || undefined}
            aria-describedby="paste-url-stores"
          />
          <Button onClick={submit}>Enter</Button>
        </div>
        {unsupported && (
          <p className="rounded-[6px] border border-border px-3 py-2 font-body text-body leading-snug text-red">
            ▸ That store isn&apos;t supported yet — the entry will be added with just
            the link; fill in the details by hand.
          </p>
        )}
      </div>
    </div>
  );
}
