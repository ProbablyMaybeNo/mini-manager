"use client";

import { useState } from "react";
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
        <div className="frame p-3">
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
          {displayed.map((img) => (
            <li
              key={img.id}
              className="frame overflow-hidden bg-[var(--color-bg-elevated)] aspect-square"
            >
              <img
                src={img.url}
                alt={img.altText ?? "Inspo reference"}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </li>
          ))}
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
