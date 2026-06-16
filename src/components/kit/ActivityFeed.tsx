import { cn } from "@/lib/cn";
import { accentText, activityAccentFor } from "@/lib/palette";
import type { ActivityEntry } from "@/lib/types";

/** Maps activity icon keys to a small pixel glyph (placeholder until Figma icons exported). */
const GLYPH: Record<string, string> = {
  add: "＋",
  cart: "▸",
  build: "▣",
  prime: "◐",
  paint: "✦",
  check: "✓",
};

/**
 * Activity tracker — one row per recent move. Each row is colour-coded by the
 * move's type using the style-guide palette (D5 / MM-45): a "created" reads
 * green, a purchase reads yellow, a stage-bump / session reads cyan, a prime
 * reads purple. The icon + the entry text share the hue so the feed scans at a
 * glance instead of being a wall of one colour.
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
      <p className={cn("font-mono text-[11px] text-fg-faint", className)}>
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
              "flex items-center gap-2 font-mono text-[11px]",
              accentText[accent],
            )}
          >
            <span aria-hidden className="opacity-80">
              {GLYPH[e.icon] ?? "•"}
            </span>
            <span className="flex-1 truncate">{e.text}</span>
            <span className="text-fg-faint">{e.when}</span>
          </li>
        );
      })}
    </ul>
  );
}
