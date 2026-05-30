"use client";

import { useState, useTransition } from "react";
import { exportAllUserData } from "@/lib/actions/exportData";

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Triggers `exportAllUserData()` and streams the JSON to the user as a
 * Blob download named `mini-manager-export-YYYYMMDD.json`. Single button;
 * no confirmation (export is non-destructive).
 */
export function ExportButton() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const res = await exportAllUserData();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const json = JSON.stringify(res.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mini-manager-export-${todayStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="font-mono text-sm uppercase tracking-wider px-4 py-2 border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "[ exporting… ]" : "[ Export all my data ]"}
      </button>
      {done ? (
        <p className="font-mono text-xs text-[var(--color-fg-muted)]">
          Download started.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="font-mono text-xs text-[var(--color-amber)]"
        >
          [ ! ] {error}
        </p>
      ) : null}
    </div>
  );
}
