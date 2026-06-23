"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, SlideOutPanel } from "@/components/kit";
import {
  createTextImport,
  fetchImportForPreview,
  applyImport,
} from "@/lib/actions/imports";
import { importBattleScribeRoster } from "@/lib/actions/importBattleScribe";
import type { ImportedTree } from "@/lib/imports/types";

/**
 * Army-list import — a slide-out (kit primitives) over the real two-step
 * importer: paste a list → createTextImport (parse + store) →
 * fetchImportForPreview (show the parsed army + units) → applyImport (create
 * the Army container + a child Unit per parsed entry), then refresh.
 *
 * BattleScribe rosters get a dedicated lane: uploading a `.ros` file reads it
 * as text and lands a full Army → Unit → Model tree directly via
 * `importBattleScribeRoster` (the structured, model-aware path). Zipped
 * `.rosz` archives aren't read client-side in v1 — unzip them and paste/upload
 * the inner `.ros`.
 */
export function ArmyImportPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [tree, setTree] = useState<ImportedTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setRaw("");
    setImportId(null);
    setTree(null);
    setError(null);
  }
  function close() {
    reset();
    onClose();
  }

  function parse() {
    setError(null);
    start(async () => {
      const res = await createTextImport({ rawText: raw.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const preview = await fetchImportForPreview(res.data.importId);
      if (!preview.ok) {
        setError(preview.error);
        return;
      }
      setImportId(res.data.importId);
      setTree(preview.tree);
    });
  }

  function onPickRosFile(file: File) {
    setError(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".rosz")) {
      setError(
        "Zipped .rosz files aren't supported yet — unzip it and import the inner .ros.",
      );
      return;
    }
    start(async () => {
      const xml = await file.text();
      const res = await importBattleScribeRoster({ xml });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.push(`/projects/${res.data.armyProjectId}`);
    });
  }

  function apply() {
    if (!importId || !tree) return;
    setError(null);
    start(async () => {
      const res = await applyImport({ importId, editedTree: tree });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <SlideOutPanel
      open={open}
      onClose={close}
      breadcrumb="DASHBOARD ▸ IMPORT"
      title="Upload Army List"
    >
      {!tree ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-body text-fg">
            Paste an army list — BattleScribe text, a points list, or plain
            unit lines. We&apos;ll turn it into an Army with a project per unit.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            placeholder={"10x Intercessors\n5x Terminators\n1x Captain"}
            className="w-full resize-y border border-cyan/50 bg-bg p-2 font-body text-body text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
          />
          {error ? <p className="font-body text-body text-red">▸ {error}</p> : null}
          <Button onClick={parse} disabled={pending || !raw.trim()} className="w-full">
            {pending ? "Parsing…" : "Parse list"}
          </Button>

          <div className="flex items-center gap-2 pt-1">
            <span className="h-px flex-1 bg-cyan/20" aria-hidden="true" />
            <span className="label-osd text-fg-faint">OR</span>
            <span className="h-px flex-1 bg-cyan/20" aria-hidden="true" />
          </div>

          <p className="font-body text-body text-fg-faint">
            Upload a BattleScribe <code>.ros</code> file to import the full
            Army → Unit → Model tree.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ros"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickRosFile(file);
              // Reset so re-selecting the same file still fires onChange.
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Importing…" : "Upload .ros file"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="import-army-name"
              className="label-osd text-fg"
            >
              Project name
            </label>
            <input
              id="import-army-name"
              value={tree.armyName}
              onChange={(e) => setTree({ ...tree, armyName: e.target.value })}
              placeholder="Name this army before importing"
              className="w-full border border-cyan/50 bg-bg px-2 py-1.5 font-body text-body text-cyan placeholder:text-fg-faint focus:border-cyan focus:outline-none"
            />
            {tree.faction || tree.totalPoints ? (
              <div className="label-osd text-fg">
                {tree.faction ?? "Army"}
                {tree.totalPoints ? ` · ${tree.totalPoints} pts` : ""}
              </div>
            ) : null}
          </div>
          <ul className="flex max-h-[300px] flex-col gap-1 overflow-y-auto border border-cyan/20 p-2">
            {tree.units.map((u, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 font-body text-body"
              >
                <span className="min-w-0 truncate text-fg">{u.name}</span>
                <span className="shrink-0 text-fg">
                  ×{u.count}
                  {u.points ? ` · ${u.points}p` : ""}
                </span>
              </li>
            ))}
          </ul>
          {error ? <p className="font-body text-body text-red">▸ {error}</p> : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} disabled={pending}>
              ← Back
            </Button>
            <Button onClick={apply} disabled={pending || !tree.armyName.trim()} className="flex-1">
              {pending
                ? "Importing…"
                : `Import ${tree.units.length} unit${tree.units.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </SlideOutPanel>
  );
}
