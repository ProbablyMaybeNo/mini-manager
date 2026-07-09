"use client";

import { useState } from "react";
import { Button, Checkbox, ModalDialog } from "@/components/kit";

/**
 * Public share-link reveal (UX-004). After a recipe is published the caller
 * opens this with the minted `/r/<slug>` URL. Unlike a fire-and-forget
 * clipboard write, the URL lives in a read-only, selectable field with an
 * explicit Copy button + "✓ Copied" confirmation — so the link is always
 * retrievable even when programmatic clipboard writes are blocked.
 *
 * Also carries the gallery-listing opt-out (defaulted ON) — this is the
 * other half of the moat loop: a shared recipe lists on `/gallery` by
 * default so it's discoverable, but painters who only want a link-only
 * share can flip it off here.
 */
export function ShareLinkDialog({
  url,
  open,
  onClose,
  listed,
  onListedChange,
}: {
  url: string | null;
  open: boolean;
  onClose: () => void;
  listed: boolean;
  onListedChange: (listed: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — the URL is still
      // visible and selectable in the field, so the user can copy it manually.
    }
  }

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      breadcrumb="RECIPE ▸ SHARE"
      title="Public share link"
      width="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        <p className="font-body text-body text-fg">
          Anyone with this link can view the recipe. It&apos;s on your clipboard —
          or copy it again below.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={url ?? ""}
            aria-label="Public recipe link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-[6px] border border-border bg-surface-2 px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
          />
          <Button
            variant={copied ? "solidGreen" : "primary"}
            className="shrink-0"
            onClick={copy}
          >
            {copied ? "✓ Copied" : "Copy"}
          </Button>
        </div>
        <label className="flex items-center gap-2 font-body text-body text-fg">
          <Checkbox
            checked={listed}
            onChange={onListedChange}
            ariaLabel="Also show in the public gallery"
          />
          Also show in the public gallery
        </label>
      </div>
    </ModalDialog>
  );
}
