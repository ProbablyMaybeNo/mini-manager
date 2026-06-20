"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Listbox } from "@/components/kit";
import { useToast } from "@/components/kit";
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
 * via the updateProjectPriority server action, then refreshes.
 */
export function PriorityDropdown({
  projectId,
  value,
}: {
  projectId: string;
  value: Priority;
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [pending, startTransition] = useTransition();

  function onChange(next: Priority) {
    if (next === value) return;
    startTransition(async () => {
      const res = await updateProjectPriority({
        id: projectId,
        priority: TO_DB_PRIORITY[next],
      });
      if (res.ok) router.refresh();
      else toast(res.error, "red");
    });
  }

  return (
    // Stop row-click (the table row opens the inspector) from firing when the
    // painter is operating the dropdown.
    <div onClick={(e) => e.stopPropagation()}>
      <Listbox<Priority>
        value={value}
        options={PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
        onChange={onChange}
        ariaLabel="Set priority"
        accent={priorityAccent[value]}
        disabled={pending}
        triggerClassName="uppercase tracking-[0.12em]"
      />
      {node}
    </div>
  );
}
