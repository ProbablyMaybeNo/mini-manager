"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "clsx";
import { addInspo, deleteInspo } from "@/lib/actions/recipeInspo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";

export interface InspoRowVm {
  id: string;
  url: string;
  label: string | null;
}

interface Props {
  recipeId: string;
  initialRows: ReadonlyArray<InspoRowVm>;
}

/**
 * Item 4 — Inspo section. A simple table where the painter saves
 * reference links / image URLs for a recipe (a technique tutorial, a
 * reference photo). Persisted via the recipeInspo server actions. One row
 * per saved link; add appends, the × deletes. Mirrors the RecipeNotes /
 * SlotList authoring patterns (Card shell, server-action transitions,
 * optimistic-safe revalidate from the action).
 */
export function RecipeInspo({ recipeId, initialRows }: Props) {
  const [rows, setRows] = useState<ReadonlyArray<InspoRowVm>>(initialRows);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(initialRows);
  }, [recipeId, initialRows]);

  const handleAdd = () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a link or image URL.");
      return;
    }
    startTransition(async () => {
      const result = await addInspo({
        recipeId,
        url: trimmed,
        label: label.trim() || undefined,
      });
      if (result.ok) {
        setRows((prev) => [
          ...prev,
          { id: result.data.id, url: result.data.url, label: result.data.label },
        ]);
        setUrl("");
        setLabel("");
      } else {
        setError(result.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    setError(null);
    const prev = rows;
    setRows((cur) => cur.filter((r) => r.id !== id));
    startTransition(async () => {
      const result = await deleteInspo({ id });
      if (!result.ok) {
        setError(result.error);
        setRows(prev);
      }
    });
  };

  return (
    <Card
      title="Inspo"
      nested
      ticks
      techLabel="INSPO"
      headerActions={
        <span className="text-2xs font-mono normal-case tracking-wider text-[var(--color-fg-subtle)]">
          {rows.length} link{rows.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs font-sans text-[var(--color-fg-subtle)] leading-snug">
          Save reference links or image URLs for this recipe — a technique
          tutorial, a reference photo, a paint-mix breakdown you found online.
        </p>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
        >
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            aria-label="Inspo link or image URL"
            className="flex-1 px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]"
          />
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Caption (optional)"
            aria-label="Inspo caption"
            className="sm:w-48 px-3 py-2 font-mono text-xs bg-[var(--color-bg)] frame focus:border-[var(--color-cyan)]"
          />
          <Button type="submit" variant="success" size="sm" disabled={isPending}>
            Add
          </Button>
        </form>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-2xs font-mono text-[var(--color-red)]"
          >
            <LogTag variant="err" />
            <span>{error}</span>
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-xs font-sans text-[var(--color-fg-muted)]">
            No inspo saved yet. Paste a link above to start a reference list.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr
                className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <th scope="col" className="px-2 py-1.5">
                  Link
                </th>
                <th scope="col" className="px-2 py-1.5 w-10 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td className="px-2 py-1.5 min-w-0">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={clsx(
                        "block font-mono text-xs text-[var(--color-cyan)] hover:underline truncate",
                      )}
                      title={row.url}
                    >
                      {row.label && row.label.length > 0 ? row.label : row.url}
                    </a>
                    {row.label && row.label.length > 0 ? (
                      <span className="block text-2xs font-mono text-[var(--color-fg-subtle)] truncate">
                        {row.url}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right align-top">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={isPending}
                      aria-label={`Remove inspo ${row.label ?? row.url}`}
                      className="tap-target inline-flex items-center justify-center font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-red)]"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
