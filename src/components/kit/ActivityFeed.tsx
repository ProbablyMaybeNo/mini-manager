import { cn } from "@/lib/cn";
import { accentText, activityAccentFor } from "@/lib/palette";
import type { ActivityEntry } from "@/lib/types";
import { StatusIcon, type StatusIconName } from "./StatusIcon";

/**
 * Activity tracker — one row per recent move. Each row is colour-coded by the
 * move's type using the style-guide palette (D5 / MM-45) and carries a minimal
 * sharp status icon (the Figma status glyphs the tracker was missing). The icon
 * inherits the row's accent via `currentColor`, so the feed scans by colour at
 * a glance instead of reading as a wall of one hue. Unknown icon keys fall back
 * to a dim accent + check glyph, so a new move type never crashes the feed.
 */
export function ActivityFeed({
  entries,
  className,
}: {
  entries: ActivityEntry[];
  className?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className={cn("font-body2 text-[11px] text-fg-faint", className)}>
        No activity yet — your painting moves will show here.
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {entries.map((e) => {
        const accent = activityAccentFor(e.icon);
        return (
          <li
            key={e.id}
            className={cn(
              "flex items-center gap-2 font-body2 text-[11px]",
              accentText[accent],
            )}
          >
            <StatusIcon name={e.icon as StatusIconName} size={13} />
            <span className="flex-1 truncate">{e.text}</span>
            <span className="text-fg-faint">{e.when}</span>
          </li>
        );
      })}
    </ul>
  );
}
