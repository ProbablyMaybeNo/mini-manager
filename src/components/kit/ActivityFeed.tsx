import { cn } from "@/lib/cn";
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

/** Activity tracker — green text rows, each with a small icon. */
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
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-2 font-mono text-[11px] text-green">
          <span aria-hidden className="text-green/80">
            {GLYPH[e.icon] ?? "•"}
          </span>
          <span className="flex-1 truncate text-glow-green">{e.text}</span>
          <span className="text-fg-faint">{e.when}</span>
        </li>
      ))}
    </ul>
  );
}
