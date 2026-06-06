"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { InspoImage } from "@/db/schema";
import { AddInspoForm } from "./AddInspoForm";
import { ManageInspoModal } from "./ManageInspoModal";

/**
 * P14.7 — Inspo gallery grid.
 *
 * 3-column Notion-style grid on `md+`, 2-column on mobile, of the
 * painter's displayed inspo URLs. Each cell renders `<img
 * src={url}>` directly — no fetch, no proxy. The image element
 * lazy-loads and falls back to the alt text on broken sources.
 *
 * "Add inspo" form sits below the grid. "Manage" button opens a
 * modal with the full list (including hidden) for show/hide toggle
 * + delete + drag-to-reorder.
 */

interface Props {
  /** Server-rendered list of `is_displayed = true` rows for the
   *  current user, already ordered by `positionIndex`. */
  displayed: ReadonlyArray<InspoImage>;
  /** Full list of the painter's rows including hidden. Passed
   *  down so the Manage modal can render without an extra
   *  round-trip when the painter taps Manage. */
  all: ReadonlyArray<InspoImage>;
}

export function InspoGalleryGrid({ displayed, all }: Props) {
  const [isManageOpen, setIsManageOpen] = useState(false);
  // UX-1103 — track per-image load failures so we can swap the broken
  // <img> for a friendly fallback tile + "open source" link. Keys are
  // the InspoImage `id` so reordering / re-rendering stays stable.
  const [brokenIds, setBrokenIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const markBroken = (id: string) => {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const hasAny = all.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          {displayed.length} on display
          {all.length > displayed.length ? (
            <span> · {all.length - displayed.length} hidden</span>
          ) : null}
        </p>
        {hasAny ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsManageOpen(true)}
          >
            Manage
          </Button>
        ) : null}
      </div>

      {displayed.length === 0 ? (
        <div className="panel p-3">
          <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
            Paste a URL from Pinterest, Instagram, or ArtStation to
            start your reference board.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Inspo gallery"
          className="grid grid-cols-2 md:grid-cols-3 gap-2"
        >
          {displayed.map((img) => {
            const isBroken = brokenIds.has(img.id);
            const altText = img.altText ?? "Inspo reference";
            return (
              <li
                key={img.id}
                className="panel overflow-hidden border-[var(--color-border-strong)] aspect-square"
              >
                {isBroken ? (
                  // UX-1103 — fallback tile for images that 503 / 403 /
                  // refuse hotlink. Painter sees a framed grey panel
                  // with a broken-image glyph + "Couldn't load — open
                  // source" link, not the alt text floating in
                  // nothing. The source URL still opens in a new tab
                  // so they can verify it themselves.
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={altText}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    <ImageOff aria-hidden size={20} />
                    <span className="font-sans text-2xs leading-snug">
                      Couldn&apos;t load — open source
                    </span>
                  </a>
                ) : (
                  <img
                    src={img.url}
                    alt={altText}
                    loading="lazy"
                    // UX-1103 — `no-referrer` reduces 403s from
                    // Pinterest's hotlink-protection by stripping
                    // the painter's referer from the request.
                    referrerPolicy="no-referrer"
                    onError={() => markBroken(img.id)}
                    className="w-full h-full object-cover"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddInspoForm />

      {isManageOpen ? (
        <ManageInspoModal
          rows={all}
          onClose={() => setIsManageOpen(false)}
        />
      ) : null}
    </div>
  );
}
