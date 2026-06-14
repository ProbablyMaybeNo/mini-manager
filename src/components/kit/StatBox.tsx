import { cn } from "@/lib/cn";
import { accentBorder, accentText, type Accent } from "@/lib/palette";

/** Compact cyan-bordered stat box: sentence-case label + big accent number. */
export function StatBox({
  label,
  value,
  accent = "cyan",
  className,
}: {
  label: string;
  value: string;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border bg-bg/60 px-4 py-3 panel-depth transition-shadow duration-200 hover:panel-depth-glow",
        accentBorder.cyan,
        className,
      )}
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      <div className="font-osd text-[11px] uppercase tracking-[0.18em] text-fg-dim">
        {label}
      </div>
      <div className={cn("mt-1 font-display text-xl leading-none", accentText[accent])}>
        {value}
      </div>
    </div>
  );
}
