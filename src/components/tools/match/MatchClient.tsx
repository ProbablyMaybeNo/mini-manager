"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import type { Paint } from "@/lib/paints/types";
import { loadPaints } from "@/lib/paints/loader";
import {
  findClosestPaints,
  type MatchResult,
} from "@/lib/tools/match/find";
import { ToolShell } from "@/components/tools/ToolShell";
import { SendToRecipeModal } from "@/components/tools/SendToRecipeModal";
import { ToolFooterActions } from "@/components/tools/ToolFooterActions";
import type { ToolPaletteSwatch } from "@/lib/tools/types";
import { MatchResultsRow } from "./MatchResultsRow";
import { Button } from "@/components/ui/Button";
import { ColorPickerDialog } from "@/components/ui/ColorPickerDialog";

const PAGE_SIZE = 50;
const HEX6 = /^#?[0-9a-fA-F]{6}$/;
const HEX3 = /^#?[0-9a-fA-F]{3}$/;

function normaliseHexInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (HEX6.test(trimmed)) {
    const body = trimmed.replace(/^#/, "");
    return `#${body.toUpperCase()}`;
  }
  if (HEX3.test(trimmed)) {
    const body = trimmed.replace(/^#/, "");
    const c0 = body.charAt(0);
    const c1 = body.charAt(1);
    const c2 = body.charAt(2);
    return `#${c0}${c0}${c1}${c1}${c2}${c2}`.toUpperCase();
  }
  return null;
}

/**
 * Cross-brand match tool. Takes a hex (typed or picked from a paint) and
 * shows the top N closest paints sorted by ΔE2000 ascending. Filter by
 * brand multi-select to narrow the field. Future P4.7 wires `[ Use ]`
 * to the send-to-recipe modal.
 */
export function MatchClient() {
  const [paints, setPaints] = useState<ReadonlyArray<Paint>>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [hexInput, setHexInput] = useState("#0E4A8A");
  const [activeHex, setActiveHex] = useState("#0E4A8A");
  const [hexError, setHexError] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<ReadonlySet<string>>(new Set());
  const [page, setPage] = useState(0);
  const [sendOne, setSendOne] = useState<ToolPaletteSwatch | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadPaints()
      .then((rows) => {
        if (mounted) setPaints(rows);
      })
      .catch(() => {
        // Catalog failure → leave the result list empty.
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Reset page when the target / brand filter changes — otherwise the
  // user can sit on page 3 of an empty list.
  useEffect(() => {
    setPage(0);
  }, [activeHex, brandFilter]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of paints) set.add(p.brand);
    return Array.from(set).sort();
  }, [paints]);

  const results: ReadonlyArray<MatchResult> = useMemo(() => {
    if (catalogLoading || paints.length === 0) return [];
    return findClosestPaints(activeHex, paints, {
      brands: brandFilter.size > 0 ? Array.from(brandFilter) : undefined,
      limit: 500,
    });
  }, [activeHex, paints, catalogLoading, brandFilter]);

  const pagedResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normaliseHexInput(hexInput);
    if (!next) {
      setHexError("Enter a valid hex like #0E4A8A");
      return;
    }
    setHexError(null);
    setActiveHex(next);
    setHexInput(next);
  };

  const toggleBrand = (b: string) => {
    setBrandFilter((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  const handleUse = (r: MatchResult) => {
    // Per V2-BUILD-PLAN ship criterion: every tool ends in "send to
    // recipe" in one click. Match emits a 1-element palette.
    setSendOne({
      hex: r.paint.hex,
      name: `${r.paint.brand} ${r.paint.name}`,
      sourcePaintId: r.paint.id,
    });
  };

  // Footer "Send to recipe" / "Save palette" hand off the active target
  // hex as a single-swatch palette. If the painter wants the top match
  // instead, they hit [ Use ] on the row.
  const footerSwatches: ReadonlyArray<ToolPaletteSwatch> = useMemo(() => {
    if (!HEX6.test(activeHex)) return [];
    return [{ hex: activeHex }];
  }, [activeHex]);

  return (
    <>
    <ToolShell
      input={
        <div className="space-y-4">
          <header className="space-y-1">
            <h1 className="text-3xl tracking-wide">MATCH</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)] leading-snug">
              Paste a hex; see the top matches across every brand. The dot
              shows how close: green = identical to the eye, amber = close,
              grey = nearest available.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-2">
            <label
              htmlFor="match-hex"
              className="block section-title mb-1 pb-0 border-0"
            >
              Target hex
            </label>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block w-10 h-10 rounded-sm border shrink-0"
                style={{
                  background: HEX6.test(activeHex) ? activeHex : "var(--color-bg-elevated)",
                  borderColor: "var(--color-border-strong)",
                }}
              />
              <input
                id="match-hex"
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="#0E4A8A"
                maxLength={7}
                className="flex-1 px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
              >
                Match
              </Button>
            </div>
            {hexError ? (
              <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
                {hexError}
              </p>
            ) : null}
            {/* R7-4 — "Start with..." opens the ColorPicker dialog so the
                painter can seed the target from the wheel, the library, or
                an eyedropped image without typing a hex. */}
            <Button
              type="button"
              onClick={() => setPickerOpen(true)}
              variant="ghost"
              size="sm"
              className="w-full"
              aria-label="Start with a colour from wheel / library / image"
            >
              Start with…
            </Button>
          </form>

          {/* NB-11: Brand filter chips — vintage solid-button styling.
              Active state is filled cyan + dark fg (high contrast, reads
              from across the room); inactive is bordered chrome with full
              fg colour (was muted, too pale to read). Min-height 28px
              meets tap-target floor without going full button-md. */}
          <div className="space-y-2">
            <p className="section-title">Brand filter · {brandFilter.size || "all"}</p>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((b) => {
                const active = brandFilter.has(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBrand(b)}
                    aria-pressed={active}
                    className={clsx(
                      "px-2.5 py-1 min-h-[28px] text-2xs font-mono uppercase tracking-[0.08em] rounded-sm border transition-colors",
                      active
                        ? "bg-[var(--color-cyan)] text-[var(--color-bg)] border-[var(--color-cyan)]"
                        : "bg-transparent text-[var(--color-fg)] border-[var(--color-border-strong)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]",
                    )}
                  >
                    {b}
                  </button>
                );
              })}
              {brandFilter.size > 0 ? (
                <Button
                  type="button"
                  onClick={() => setBrandFilter(new Set())}
                  variant="danger"
                  size="sm"
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {sendOne ? null : null}
        </div>
      }
      output={
        <div className="space-y-3">
          <header className="flex items-baseline justify-between">
            <h2 className="section-title mb-0 pb-0 border-0">
              Results · {results.length}
            </h2>
            <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
              Page {page + 1} / {pageCount}
            </p>
          </header>
          <div
            className="frame"
            role="table"
            aria-label="Match results"
          >
            <div
              className="grid grid-cols-[24px_1fr_72px_56px] items-center gap-2 px-2 py-1 border-b border-[var(--color-border-strong)] text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
              role="row"
            >
              <span role="columnheader" aria-label="Swatch" />
              <span role="columnheader">Paint</span>
              <span
                role="columnheader"
                className="text-right inline-flex items-center justify-end gap-1 cursor-help"
                title="ΔE = colour difference (CIE Delta-E 2000). Lower is closer: under 1 is imperceptible, 1–3 is a close match, 5+ is noticeably different."
                aria-label="ΔE colour difference"
              >
                <span>ΔE</span>
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-border-strong)] text-[10px] leading-none font-mono normal-case tracking-normal text-[var(--color-fg-subtle)]"
                >
                  ?
                </span>
              </span>
              <span role="columnheader" aria-label="Actions" />
            </div>
            {catalogLoading ? (
              <p className="px-3 py-3 text-xs font-mono text-[var(--color-fg-muted)]">
                Loading catalog…
              </p>
            ) : pagedResults.length === 0 ? (
              <p className="px-3 py-3 text-xs font-mono text-[var(--color-fg-muted)]">
                No matches — try a different brand filter.
              </p>
            ) : (
              pagedResults.map((r) => (
                <MatchResultsRow
                  key={r.paint.id}
                  result={r}
                  onUse={handleUse}
                  showAssign
                />
              ))
            )}
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-2xs font-mono text-[var(--color-fg-muted)] disabled:opacity-40 hover:text-[var(--color-cyan)] tap-target px-2 frame"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="text-2xs font-mono text-[var(--color-fg-muted)] disabled:opacity-40 hover:text-[var(--color-cyan)] tap-target px-2 frame"
              >
                Next →
              </button>
            </div>
          ) : null}
        </div>
      }
      footer={
        <ToolFooterActions
          toolId="match"
          swatches={footerSwatches}
          defaultPaletteName={`Match ${activeHex}`}
        />
      }
    />
    {sendOne ? (
      <SendToRecipeModal
        open={sendOne !== null}
        onClose={() => setSendOne(null)}
        swatches={[sendOne]}
        toolId="match"
      />
    ) : null}
    <ColorPickerDialog
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      initialHex={HEX6.test(activeHex) ? activeHex : null}
      contextLabel="Match target"
      onSelect={(hex) => {
        const upper = hex.toUpperCase();
        setHexInput(upper);
        setActiveHex(upper);
        setHexError(null);
      }}
    />
    </>
  );
}
