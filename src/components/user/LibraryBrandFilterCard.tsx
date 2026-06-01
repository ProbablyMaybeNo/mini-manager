"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { setLibraryBrandFilterAction } from "@/lib/actions/libraryBrandFilter";

interface Props {
  /** All catalog brands the user could pick from. Ordered. */
  availableBrands: ReadonlyArray<string>;
  /** The painter's currently-saved selection — null means "all
   *  brands visible" (the default seat). An array means "only these
   *  brands". */
  initial: ReadonlyArray<string> | null;
}

/**
 * P12.19 — Persistent library brand filter on /user.
 *
 * Renders one checkbox per brand. Default state when no filter is
 * saved is "all checked" (= no filter); unchecking any brand starts
 * narrowing. "Show all" + "Hide all" shortcuts at the top. Save
 * persists to users.libraryBrandFilter via the server action.
 *
 * The /library page reads this column as the FilterRail initial
 * brand selection on next load.
 */
export function LibraryBrandFilterCard({
  availableBrands,
  initial,
}: Props) {
  const initialSelection = new Set(initial ?? availableBrands);
  const [selected, setSelected] = useState<Set<string>>(initialSelection);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = (brand: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const showAll = () => setSelected(new Set(availableBrands));
  const hideAll = () => setSelected(new Set());

  const handleSave = () => {
    setError(null);
    setSuccess(false);
    // Empty + all-checked both mean "no filter" — write null to keep
    // the column compact. A real selection writes the explicit array.
    const allChecked =
      selected.size === availableBrands.length &&
      availableBrands.every((b) => selected.has(b));
    const payload = allChecked ? null : Array.from(selected);
    startTransition(async () => {
      const result = await setLibraryBrandFilterAction({ brands: payload });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2500);
    });
  };

  const selectedCount = selected.size;
  const allChecked = selectedCount === availableBrands.length;

  return (
    <Card title="Library brand filter" ariaLabel="Library brand filter">
      <p className="text-xs font-sans text-[var(--color-fg-subtle)] mb-3 leading-snug">
        Pick which brands the library shows by default. Saved across
        sessions — the /library page reads this filter on every load
        and uses it as the initial state.
      </p>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={showAll}
          disabled={isPending || allChecked}
        >
          Show all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={hideAll}
          disabled={isPending || selectedCount === 0}
        >
          Hide all
        </Button>
        <span className="text-2xs font-mono text-[var(--color-fg-muted)]">
          {selectedCount} / {availableBrands.length} brand{availableBrands.length === 1 ? "" : "s"} visible
        </span>
      </div>
      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 mb-3"
        role="list"
        aria-label="Brands"
      >
        {availableBrands.map((brand) => {
          const checked = selected.has(brand);
          return (
            <li key={brand}>
              <label
                className={clsx(
                  "flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-cyan)_6%,transparent)]",
                  checked
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)]",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(brand)}
                  className="accent-[var(--color-cyan)]"
                />
                <span className="text-xs font-mono truncate">{brand}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-2xs font-mono text-[var(--color-red)] mb-2">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="text-2xs font-mono text-[var(--color-green)] mb-2"
        >
          Filter saved. The library will use it next load.
        </p>
      ) : null}
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Save filter"}
      </Button>
    </Card>
  );
}
