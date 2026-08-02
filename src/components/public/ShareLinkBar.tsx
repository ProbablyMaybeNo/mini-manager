"use client";

import { useEffect, useState } from "react";

/**
 * The recipe card's shareable-link row — sits directly under the title.
 * Renders the relative path immediately (so it's never blank) then upgrades
 * to the full absolute URL once mounted, since the origin isn't known
 * server-side. Copies the absolute URL to the clipboard.
 */
export function ShareLinkBar({ path }: { path: string }) {
  const [href, setHref] = useState(path);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHref(`${window.location.origin}${path}`);
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the link is already
      // visible + selectable, so this is a soft failure.
    }
  }

  return (
    // R2-6 — `min-w-0` is what stops this bar dragging the layout viewport
    // wider than the phone. The URL span sets `min-w-0` on ITSELF, but that
    // only lifts the shrink floor; the span is `truncate` (white-space:
    // nowrap), so its min-content contribution is still the whole URL, and
    // this row is a flex item whose automatic minimum size is that
    // min-content. The row therefore refused to shrink below ~471px inside a
    // 375px screen. `min-w-0` here lets the row take the width the page gives
    // it, and the span's existing truncate then does its job.
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-[8px] border border-cyan/30 bg-bg/40 px-3 py-2">
      <span aria-hidden className="shrink-0 text-cyan-lite">
        ⛓
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-cyan-lite">
        {href}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-[6px] border border-cyan/40 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-cyan-lite transition-colors hover:bg-cyan/10"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
