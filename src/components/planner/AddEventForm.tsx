"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { createEvent } from "@/lib/actions/events";
import { eventKinds, type EventKind } from "@/db/schema";

/**
 * P14.3 — Inline add-event form for the dashboard calendar widget.
 *
 * Lives directly under the month grid. Painter fills name + date +
 * kind + optional notes, hits Add, and the calendar re-renders with
 * the new dot painted on the right day.
 *
 * Solid-fill Button discipline (P13.1): the Add button uses the
 * `success` variant (neon-green) — it's a CREATE action. No cyan.
 */

interface Props {
  /** Pre-selected day when the painter clicked an empty cell. Empty
   *  string when the form is in its bare state. */
  initialDate?: string;
}

const KIND_LABEL: Record<EventKind, string> = {
  tournament: "Tournament",
  deadline: "Deadline",
  battle: "Battle",
  other: "Other",
};

export function AddEventForm({ initialDate = "" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(initialDate);
  const [kind, setKind] = useState<EventKind>("tournament");
  const [notes, setNotes] = useState("");

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!date) {
      setError("Pick a date");
      return;
    }
    startTransition(async () => {
      const res = await createEvent({
        name: name.trim(),
        date,
        kind,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      setDate("");
      setNotes("");
      setKind("tournament");
      router.refresh();
    });
  };

  const inputCls = clsx(
    "frame px-3 py-1.5 font-sans text-sm",
    "bg-[var(--color-bg-panel)] text-[var(--color-fg)]",
    "border border-[var(--color-border-strong)] rounded-sm",
    "focus:outline-2 focus:outline-[var(--color-accent)]",
  );

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Add event"
      className="flex flex-col gap-2 mt-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AdeptiCon"
            maxLength={120}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Kind
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EventKind)}
            className={inputCls}
          >
            {eventKinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Anything to remember — location, list, prep notes."
          className={inputCls}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="success"
          size="sm"
          disabled={isPending}
        >
          {isPending ? "Adding…" : "Add event"}
        </Button>
        {error ? (
          <span
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
