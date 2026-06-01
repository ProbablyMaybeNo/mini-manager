"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { applyImport } from "@/lib/actions/imports";
import type { ImportedTree } from "@/lib/imports/types";
import { LogTag } from "@/components/ui/LogTag";
import { Button } from "@/components/ui/Button";

interface ImportPreviewProps {
  importId: string;
  initialTree: ImportedTree;
  parserUsed: string | null;
  confidence: number | null;
  warnings: ReadonlyArray<string>;
}

interface UnitRow {
  key: string;
  name: string;
  count: string;
  points: string;
  notes: string;
}

let rowIdCounter = 0;
const nextRowKey = (): string => `u-${++rowIdCounter}`;

export function ImportPreview({
  importId,
  initialTree,
  parserUsed,
  confidence,
  warnings,
}: ImportPreviewProps) {
  const router = useRouter();
  const [armyName, setArmyName] = useState(initialTree.armyName);
  const [faction, setFaction] = useState(initialTree.faction ?? "");
  const [totalPoints, setTotalPoints] = useState(
    initialTree.totalPoints?.toString() ?? "",
  );
  const [units, setUnits] = useState<UnitRow[]>(() =>
    initialTree.units.map((u) => ({
      key: nextRowKey(),
      name: u.name,
      count: String(u.count),
      points: u.points !== undefined ? String(u.points) : "",
      notes: u.notes ?? "",
    })),
  );
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onUnitChange = (key: string, patch: Partial<UnitRow>) => {
    setUnits((prev) =>
      prev.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    );
  };

  const onRemoveUnit = (key: string) => {
    setUnits((prev) => prev.filter((u) => u.key !== key));
  };

  const onAddUnit = () => {
    setUnits((prev) => [
      ...prev,
      { key: nextRowKey(), name: "", count: "1", points: "", notes: "" },
    ]);
  };

  const onApply = async () => {
    setError(null);

    const trimmedName = armyName.trim();
    if (trimmedName.length === 0) {
      setError("Army name can't be empty.");
      return;
    }
    if (units.length === 0) {
      setError("Add at least one unit before applying.");
      return;
    }

    const editedUnits = [];
    for (const u of units) {
      const name = u.name.trim();
      if (name.length === 0) {
        setError("Each unit needs a name.");
        return;
      }
      const count = Number.parseInt(u.count, 10);
      if (!Number.isFinite(count) || count < 1) {
        setError(`"${name}" needs a count of at least 1.`);
        return;
      }
      const pointsRaw = u.points.trim();
      const points =
        pointsRaw.length === 0 ? null : Number.parseInt(pointsRaw, 10);
      if (points !== null && !Number.isFinite(points)) {
        setError(`"${name}": points must be a number.`);
        return;
      }
      editedUnits.push({
        name,
        count,
        points,
        notes: u.notes.trim().length > 0 ? u.notes.trim() : null,
      });
    }

    const totalPointsTrim = totalPoints.trim();
    const totalPointsNum =
      totalPointsTrim.length === 0 ? null : Number.parseInt(totalPointsTrim, 10);

    const editedTree: ImportedTree = {
      armyName: trimmedName,
      ...(totalPointsNum !== null ? { totalPoints: totalPointsNum } : {}),
      ...(faction.trim().length > 0 ? { faction: faction.trim() } : {}),
      units: editedUnits.map((u) => ({
        name: u.name,
        count: u.count,
        ...(u.points !== null ? { points: u.points } : {}),
        ...(u.notes !== null ? { notes: u.notes } : {}),
      })),
    };

    setBusy(true);
    try {
      const result = await applyImport({ importId, editedTree });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/${result.data.armyProjectId}`);
    } finally {
      setBusy(false);
    }
  };

  const confidencePct =
    typeof confidence === "number" ? Math.round(confidence * 100) : null;

  return (
    <div className="space-y-6">
      <div className="frame p-4 space-y-1 text-xs font-mono">
        <p className="flex items-center gap-2 flex-wrap">
          <LogTag
            variant={
              confidencePct === null
                ? "info"
                : confidencePct >= 80
                  ? "okay"
                  : "warn"
            }
          />
          <span>
            Parsed via{" "}
            <span className="text-[var(--color-cyan)]">{parserUsed ?? "unknown"}</span>
            {confidencePct !== null ? (
              <>
                , confidence{" "}
                <span
                  className={clsx(
                    confidencePct >= 80 && "text-[var(--color-green)]",
                    confidencePct < 60 && "text-[var(--color-amber)]",
                  )}
                >
                  {confidencePct}%
                </span>
              </>
            ) : null}
          </span>
        </p>
        {warnings.length > 0 ? (
          <details
            open={warningsOpen}
            onToggle={(e) => setWarningsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-[var(--color-amber)]">
              {warnings.length} warning{warnings.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 ml-4 list-none text-[var(--color-fg-muted)] space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <LogTag variant="warn" className="mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Army</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Name
            </span>
            <input
              value={armyName}
              onChange={(e) => setArmyName(e.target.value)}
              maxLength={120}
              className="w-full mt-1 p-2 frame font-mono text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Faction
            </span>
            <input
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              maxLength={120}
              className="w-full mt-1 p-2 frame font-mono text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Total points
            </span>
            <input
              type="number"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value)}
              min={0}
              max={99999}
              className="w-full mt-1 p-2 frame font-mono text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title flex items-baseline gap-2">
          <span>Units</span>
          <span className="text-xs text-[var(--color-fg-muted)] normal-case tracking-normal">
            {units.length} row{units.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="space-y-2">
          {units.map((u) => (
            <div
              key={u.key}
              className="frame p-3 grid grid-cols-12 gap-2 items-center"
            >
              <input
                aria-label={`Unit ${u.key} name`}
                value={u.name}
                onChange={(e) => onUnitChange(u.key, { name: e.target.value })}
                placeholder="Unit name"
                maxLength={120}
                className="col-span-12 md:col-span-5 p-2 frame font-mono text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <input
                aria-label={`Unit ${u.key} count`}
                type="number"
                value={u.count}
                onChange={(e) => onUnitChange(u.key, { count: e.target.value })}
                min={1}
                max={999}
                className="col-span-4 md:col-span-2 p-2 frame font-mono text-sm bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <input
                aria-label={`Unit ${u.key} points`}
                type="number"
                value={u.points}
                onChange={(e) => onUnitChange(u.key, { points: e.target.value })}
                placeholder="pts"
                min={0}
                max={99999}
                className="col-span-4 md:col-span-2 p-2 frame font-mono text-sm bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <input
                aria-label={`Unit ${u.key} notes`}
                value={u.notes}
                onChange={(e) => onUnitChange(u.key, { notes: e.target.value })}
                placeholder="Notes"
                maxLength={500}
                className="col-span-12 md:col-span-2 p-2 frame font-mono text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <div className="col-span-12 md:col-span-1 flex items-center justify-center">
                <Button
                  type="button"
                  onClick={() => onRemoveUnit(u.key)}
                  aria-label={`Remove ${u.name || "unit"}`}
                  variant="danger"
                  size="sm"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            onClick={onAddUnit}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Add unit
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        {error ? (
          <p role="alert" className="flex items-start gap-2 text-sm font-mono text-[var(--color-amber)]">
            <LogTag variant="err" className="mt-0.5" />
            <span>{error}</span>
          </p>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={onApply}
          disabled={busy || units.length === 0}
          variant="success"
          size="sm"
        >
          {busy ? "Applying…" : "Apply → create projects"}
        </Button>
      </div>
    </div>
  );
}
