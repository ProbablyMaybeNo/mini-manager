"use client";

import { useState, useTransition } from "react";
import { Input, Listbox, Panel } from "@/components/kit";
import { createProject } from "@/lib/actions/projects";
import type { ProjectType } from "@/lib/types";
import { InspectorActionBar } from "./InspectorActionBar";

const TYPE_OPTIONS: ProjectType[] = ["Army", "Warband", "Unit", "Model", "Terrain"];

/** App type → DB projectTypes literal (createProject input). Mirrors the map in
 *  ProjectWorkspaceBody. */
const TYPE_TO_DB: Record<ProjectType, "Army" | "Warband" | "Unit" | "Model" | "Terrain Piece"> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  Terrain: "Terrain Piece",
};

/**
 * The new-project CREATE-mode body (RF-8). Replaces the old NewProjectPanel
 * mini-form: "+ New Project" opens the project page directly in create mode with
 * blank/default fields, and the bottom-bar SAVE (RF-1, here labelled "Create")
 * persists via createProject. Nothing is written until SAVE — the form state is
 * held client-side, so cancel/close discards with no orphan row. On success the
 * caller (`onCreated`) opens the new id's panel as the normal edit view.
 *
 * Rendered inside the SAME inspector shells as the edit body — InspectorPane on
 * desktop, the full-screen mobile takeover (RF-10) on phones — so it reads as
 * "the project page, blank".
 */
export function CreateProjectView({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("Army");
  const [count, setCount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameValid = name.trim().length > 0;

  function save() {
    if (!nameValid) {
      setError("Name is required.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createProject({
        name: name.trim(),
        type: TYPE_TO_DB[type],
        count: Number(count) || 0,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.id) onCreated(res.data.id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel label="DETAILS" className="p-4 pt-5">
        <p className="mb-3 font-body text-body text-fg-dim">
          Name your project, pick its type, and how many models it holds. Hit
          CREATE when you’re ready — nothing is saved until then.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            name="project-name"
            label="Name"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            placeholder="Salamanders 2k"
            error={error && !nameValid ? error : undefined}
            autoFocus
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="label-osd text-fg-dim">Type</span>
              <Listbox
                value={type}
                disabled={pending}
                ariaLabel="Project type"
                options={TYPE_OPTIONS.map((t) => ({ value: t, label: t.toUpperCase() }))}
                onChange={setType}
              />
            </label>
            <Input
              name="model-count"
              label="Model count"
              type="number"
              value={count}
              disabled={pending}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>
      </Panel>

      {error && nameValid && <p className="font-body text-body text-red">▸ {error}</p>}

      {/* Reuse the RF-1 action bar — only SAVE (relabelled CREATE) is live in
          create mode; the lifecycle verbs (Focus/Delete/Archive/Duplicate) make
          no sense before the row exists, so they're omitted. */}
      <InspectorActionBar
        disabled={pending}
        saveLabel={pending ? "Creating…" : "Create"}
        saveDisabled={!nameValid}
        onSave={save}
      />
    </div>
  );
}
