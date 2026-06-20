import { cn } from "@/lib/cn";
import {
  accentBorder,
  accentText,
  priorityAccent,
  projectTypeAccent,
  statusAccent,
  STATUS_LABEL,
  type Accent,
} from "@/lib/palette";
import type { Priority, ProjectStatus, ProjectType } from "@/lib/types";
import { StatusIcon } from "./StatusIcon";

/** Statuses that have one of Ross's bespoke pixel-art glyphs. */
const STATUS_WITH_GLYPH: ReadonlySet<ProjectStatus> = new Set([
  "WISHLIST",
  "OWNED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
]);

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

/** Colour-coded status badge — rendered as a bordered Chip so every status
 *  reads as a consistent badge (WISHLIST gets the bordered yellow treatment
 *  rather than bare text). */
export function StatusText({ status }: { status: ProjectStatus }) {
  return (
    <Chip accent={statusAccent[status]} className="gap-1.5">
      {STATUS_WITH_GLYPH.has(status) && (
        <StatusIcon name={status} size={13} title={STATUS_LABEL[status]} />
      )}
      {STATUS_LABEL[status]}
    </Chip>
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
