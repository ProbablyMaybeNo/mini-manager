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
            <h1 className="text-xl glow-green">┌─ MATCH ─</h1>
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Paste a hex; see the top matches across every brand. Green
              dot = ΔE &lt; 2 (perceptually identical), amber &lt; 5, grey
              ≥ 5.
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
                className="flex-1 px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 frame-strong tap-target text-xs font-mono uppercase tracking-wider hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]"
              >
                [ Match ]
              </button>
            </div>
            {hexError ? (
              <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
                {hexError}
              </p>
            ) : null}
          </form>

          <div className="space-y-2">
            <p className="section-title">Brand filter · {brandFilter.size || "all"}</p>
            <div className="flex flex-wrap gap-1">
              {brands.map((b) => {
                const active = brandFilter.has(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBrand(b)}
                    className={clsx(
                      "px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wider frame tap-target",
                      active
                        ? "border-[var(--color-cyan)] text-[var(--color-cyan)]"
                        : "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)]",
                    )}
                  >
                    {b}
                  </button>
                );
              })}
              {brandFilter.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setBrandFilter(new Set())}
                  className="px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wider text-[var(--color-red)] tap-target"
                >
                  [ × Clear ]
                </button>
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
          <div className="frame">
            <div className="grid grid-cols-[24px_1fr_72px_56px] items-center gap-2 px-2 py-1 border-b border-[var(--color-border-strong)] text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              <span />
              <span>Paint</span>
              <span className="text-right">ΔE</span>
              <span />
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
    </>
  );
}
