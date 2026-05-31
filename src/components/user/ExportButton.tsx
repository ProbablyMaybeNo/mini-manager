"use client";

import { useState, useTransition } from "react";
import { exportAllUserData } from "@/lib/actions/exportData";
import { Button } from "@/components/ui/Button";

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
      <Button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        variant="secondary"
        size="md"
      >
        {isPending ? "Exporting…" : "Export all my data"}
      </Button>
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
