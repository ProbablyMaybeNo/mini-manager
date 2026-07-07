"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/components/kit";
import { cn } from "@/lib/cn";
import {
  SUPPORTED_STORE_NAMES,
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
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <KindToggle value={kind} onChange={setKind} />
        <Input
          name="paste-url"
          aria-label="Paste a store URL"
          placeholder="Paste a store URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          containerClassName="min-w-[260px] flex-1"
          aria-invalid={unsupported || undefined}
          aria-describedby="paste-url-stores"
        />
        <Button onClick={submit}>Enter</Button>
      </div>
      <p
        id="paste-url-stores"
        className="rounded-[6px] border border-border px-3 py-2 font-body text-body leading-snug text-fg"
      >
        {unsupported ? (
          <span className="text-red">
            ▸ That store isn&apos;t supported yet — the entry will be added with just
            the link; fill in the details by hand.
          </span>
        ) : (
          <>
            Auto-fills from:{" "}
            <span className="text-purple">{SUPPORTED_STORE_NAMES.join(", ")}</span>.
            Other links still add a row — you just enter the details yourself.
          </>
        )}
      </p>
    </div>
  );
}
