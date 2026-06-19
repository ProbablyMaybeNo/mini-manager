import { cn } from "@/lib/cn";
import {
  accentBorder,
  accentText,
  priorityAccent,
  projectTypeAccent,
  statusAccent,
  type Accent,
} from "@/lib/palette";
import type { Priority, ProjectStatus, ProjectType } from "@/lib/types";

/** Colour-coded pill (project type and other taxonomies). */
export function Chip({
  children,
  accent = "cyan",
  className,
}: {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-osd text-[12px] uppercase tracking-[0.15em]",
        accentBorder[accent],
        accentText[accent],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TypeChip({ type }: { type: ProjectType }) {
  return <Chip accent={projectTypeAccent[type]}>{type}</Chip>;
}

/** Colour-coded status word (no border — the design renders status as coloured text). */
export function StatusText({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "font-osd text-[12px] uppercase tracking-[0.15em]",
        accentText[statusAccent[status]],
      )}
    >
      {status}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "font-osd text-[12px] uppercase tracking-[0.15em]",
        accentText[priorityAccent[priority]],
      )}
    >
      {priority}
    </span>
  );
}
