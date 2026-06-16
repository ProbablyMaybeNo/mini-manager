import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/palette";
import type { ActivityEntry } from "@/lib/types";
import { StatusIcon, type StatusIconName } from "./StatusIcon";

/** Activity icon key → accent, so the feed uses the full palette rather than
 *  reading as a wall of green (created=green, acquire=cyan, build=purple,
 *  prime=purple, paint=yellow, check=green). */
const ICON_ACCENT: Record<string, Accent> = {
  add: "green",
  cart: "cyan",
  build: "purple",
  prime: "purple",
  paint: "yellow",
  check: "green",
  alert: "red",
};

/** Activity tracker — each row carries a minimal sharp status icon + accent. */
export function ActivityFeed({
  entries,
  className,
}: {
  entries: ActivityEntry[];
  className?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className={cn("font-mono text-[11px] text-fg-faint", className)}>
        No activity yet — your painting moves will show here.
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {entries.map((e) => {
        const accent = ICON_ACCENT[e.icon] ?? "green";
        return (
          <li key={e.id} className="flex items-center gap-2 font-mono text-[11px] text-fg-dim">
            <StatusIcon name={e.icon as StatusIconName} accent={accent} size={13} />
            <span className="flex-1 truncate">{e.text}</span>
            <span className="text-fg-faint">{e.when}</span>
          </li>
        );
      })}
    </ul>
  );
}
