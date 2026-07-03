import { cn } from "@/lib/cn";
import {
  accentDot,
  priorityAccent,
  projectTypeAccent,
  statusAccent,
  STATUS_LABEL,
  type Accent,
} from "@/lib/palette";
import type { Priority, ProjectStatus, ProjectType } from "@/lib/types";
import { StatusIcon } from "./StatusIcon";

/** Tinted-pill classes per accent: colour@13% fill + colour@25% border +
 *  colour text — the HEX.CODE status-pill / filter-chip treatment (4:4). */
const pillTint: Record<Accent, string> = {
  cyan: "bg-cyan/15 border-cyan/25 text-cyan",
  green: "bg-green/15 border-green/25 text-green",
  yellow: "bg-yellow/15 border-yellow/25 text-yellow",
  orange: "bg-orange/15 border-orange/25 text-orange",
  purple: "bg-purple/15 border-purple/25 text-purple",
  red: "bg-red/15 border-red/25 text-red",
  dim: "bg-fg/5 border-border text-fg-muted",
  neutral: "bg-fg/5 border-border text-fg",
  "priority-low": "bg-priority-low/15 border-priority-low/25 text-priority-low",
  "priority-med": "bg-priority-med/15 border-priority-med/25 text-priority-med",
  "priority-high": "bg-priority-high/15 border-priority-high/25 text-priority-high",
};

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

/** Colour-coded tinted pill (status / project type / other taxonomies) — the
 *  HEX.CODE outline-pill: tinted fill + colour border + colour text, mono bold,
 *  4px radius (4:4 badges + filter chips). */
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
        "inline-flex items-center rounded-[4px] border px-2 py-0.5 font-mono font-bold text-[10px] uppercase tracking-wide",
        pillTint[accent],
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

/** Priority readout — coloured dot + uppercase label (4:4): HIGH red, MED
 *  orange/yellow, LOW dim. The dot carries the colour; the label stays bright. */
export function PriorityTag({ priority }: { priority: Priority }) {
  const accent = priorityAccent[priority];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase text-fg">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accentDot[accent])} aria-hidden />
      {priority}
    </span>
  );
}
