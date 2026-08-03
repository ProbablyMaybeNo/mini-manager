"use client";

import { useOptimistic, useTransition } from "react";
import { Listbox } from "@/components/kit";
import { useToast } from "@/components/kit";
import { guarded } from "@/lib/actionGuard";
import { updateProjectPriority } from "@/lib/actions/projects";
import { priorityAccent } from "@/lib/palette";
import type { Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["High", "Med", "Low"];

/** kit Priority (Low/Med/High) → DB priority column value (the action's enum).
 *  Mirrors PRIORITY_MAP in appData (which collapses Urgent→High on read). */
const TO_DB_PRIORITY: Record<Priority, "High" | "Medium" | "Low"> = {
  High: "High",
  Med: "Medium",
  Low: "Low",
};

/**
 * Inline PRIORITY cell on the PROJECTS table (ynb3l8JdxhaE) — a real dropdown
 * so painters can set priority from the table. Inherits the kit Listbox
 * "+Attach" treatment (thinner font + dotted border) and colours the trigger by
 * priority: Red = High, orange = Med, Yellow = Low (priorityAccent). Persists
 * via the updateProjectPriority server action; the force-dynamic dashboard
 * re-renders on the POST, so no manual refresh (P1/P2).
 */
export function PriorityDropdown({
  projectId,
  value,
}: {
  projectId: string;
  value: Priority;
}) {
  const { toast, node } = useToast();
  const [, startTransition] = useTransition();
  // Optimistic value — the pick shows instantly, then resets to the fresh
  // prop when the dashboard re-renders from the server-action POST.
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  function onChange(next: Priority) {
    if (next === optimisticValue) return;
    startTransition(async () => {
      setOptimisticValue(next);
      // R2-14 — one dropdown pick on the projects table used to be enough to
      // replace the whole dashboard with the fault screen when the connection
      // dropped. Now it's a toast and the optimistic pick reverts on the next
      // server render, exactly as it does for a handled failure.
      const res = await guarded(
        () =>
          updateProjectPriority({
            id: projectId,
            priority: TO_DB_PRIORITY[next],
          }),
        "Couldn’t set the priority — check your connection, then try again.",
      );
      if (!res.ok) toast(res.error, "red");
    });
  }

  return (
    // Stop row-click (the table row opens the inspector) from firing when the
    // painter is operating the dropdown.
    <div onClick={(e) => e.stopPropagation()}>
      <Listbox<Priority>
        value={optimisticValue}
        options={PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
        onChange={onChange}
        ariaLabel="Set priority"
        accent={priorityAccent[optimisticValue]}
        size="xs"
        triggerClassName="uppercase tracking-[0.04em] min-[600px]:tracking-[0.12em]"
      />
      {node}
    </div>
  );
}
