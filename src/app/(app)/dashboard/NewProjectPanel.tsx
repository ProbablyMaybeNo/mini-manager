"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, SlideOutPanel } from "@/components/kit";
import { createProject } from "@/lib/actions/projects";

const TYPES = ["Army", "Warband", "Unit", "Model", "Terrain Piece", "Diorama"] as const;

/** New-project create flow — a slide-out composed from kit primitives (the
 *  kit's "+ Add Project" affordance opens it). Persists via the real
 *  createProject action, then refreshes so the dashboard table reloads. */
export function NewProjectPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired with the new project id so the caller can open its detail panel. */
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("Army");
  const [count, setCount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await createProject({
        name: name.trim(),
        type: type as (typeof TYPES)[number],
        count: Number(count) || 0,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      setCount("0");
      onClose();
      if (res.data?.id) onCreated?.(res.data.id);
      router.refresh();
    });
  }

  return (
    <SlideOutPanel
      open={open}
      onClose={onClose}
      breadcrumb="DASHBOARD ▸ NEW"
      title="New Project"
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Project name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Salamanders 2k"
        />
        <label className="flex flex-col gap-1 label-osd text-fg">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border border-cyan/50 bg-bg px-2 py-1.5 font-body text-body text-fg focus:border-cyan focus:outline-none"
          >
            {TYPES.map((t) => (
              <option key={t} value={t} className="bg-bg text-fg">
                {t}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Model count"
          name="count"
          type="number"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        {error ? <p className="font-body text-body text-red">▸ {error}</p> : null}
        <Button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="w-full"
        >
          {pending ? "Creating…" : "Create project"}
        </Button>
      </div>
    </SlideOutPanel>
  );
}
