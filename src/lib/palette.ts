import type {
  CalendarEventKind,
  Priority,
  ProjectStatus,
  ProjectType,
} from "./types";

/** Accent keys map 1:1 onto the Tailwind token colours generated from globals.css. */
export type Accent =
  | "cyan"
  | "green"
  | "yellow"
  | "orange"
  | "purple"
  | "red"
  | "dim";

export const accentText: Record<Accent, string> = {
  cyan: "text-cyan",
  green: "text-green",
  yellow: "text-yellow",
  orange: "text-orange",
  purple: "text-purple",
  red: "text-red",
  dim: "text-fg-dim",
};

export const accentBg: Record<Accent, string> = {
  cyan: "bg-cyan",
  green: "bg-green",
  yellow: "bg-yellow",
  orange: "bg-orange",
  purple: "bg-purple",
  red: "bg-red",
  dim: "bg-fg-faint",
};

export const accentBorder: Record<Accent, string> = {
  cyan: "border-cyan",
  green: "border-green",
  yellow: "border-yellow",
  orange: "border-orange",
  purple: "border-purple",
  red: "border-red",
  dim: "border-fg-faint",
};

/** Per-accent phosphor text-glow (maps onto the text-glow-* utilities in
 *  globals.css). `dim` has no phosphor token, so it stays un-glowed. */
export const accentTextGlow: Record<Accent, string> = {
  cyan: "text-glow-cyan",
  green: "text-glow-green",
  yellow: "text-glow-yellow",
  orange: "text-glow-yellow",
  purple: "text-glow-purple",
  red: "text-glow-red",
  dim: "",
};

export const projectTypeAccent: Record<ProjectType, Accent> = {
  Army: "cyan",
  Warband: "purple",
  Unit: "green",
  Model: "yellow",
  Terrain: "red",
};

/**
 * Spec wording for each lifecycle status (BUILDING→BUILT, …). Shared so the
 * inspector Listbox, the collection StatusDropdown and StatusText all read the
 * SAME word for a given state — the enum value stays internal, the painter only
 * ever sees the spec label. Lives here (not in a "use client" component) so kit
 * primitives can import it without a client-boundary / import cycle.
 */
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  BUILDING: "BUILT",
  PRIMING: "PRIMED",
  PAINTING: "PAINTED",
  BASING: "BASED",
  COMPLETE: "COMPLETE",
  SHELVED: "HOLD",
};

export const statusAccent: Record<ProjectStatus, Accent> = {
  WISHLIST: "yellow",
  // OWNED reads neon green — the "you have this" status, mirroring the green
  // owned-state used in the library/collection (bKcN: PURCHASED → OWNED green).
  OWNED: "green",
  BUILDING: "cyan",
  PRIMING: "purple",
  PAINTING: "cyan",
  BASING: "green",
  COMPLETE: "green",
  SHELVED: "dim",
};

/** Priority → accent (ynb3l8JdxhaE): Red = High, orange = Med, Yellow = Low. */
export const priorityAccent: Record<Priority, Accent> = {
  Low: "yellow",
  Med: "orange",
  High: "red",
};

/** Calendar event kind → accent (shared by the calendar dots + the ticker). */
export const eventKindAccent: Record<CalendarEventKind, Accent> = {
  tournament: "cyan",
  deadline: "red",
  battle: "yellow",
  other: "purple",
};

/**
 * Activity icon-key → accent (D5 / MM-45). The ActivityFeed used to render
 * every row green; colour-coding by the move's type makes the tracker
 * glanceable using the full style-guide palette:
 *   add    → green  (something new — project / slot created)
 *   cart   → yellow (a purchase / wishlist add — "spend" warning hue)
 *   build  → cyan   (a stage bump — primary "progress" colour)
 *   prime  → purple (special prep stage)
 *   paint  → cyan   (logged a painting session — core action)
 *   check  → green  (a recipe / completion — positive)
 * Unknown keys fall back to dim so a new icon never crashes the feed.
 */
export const activityAccent: Record<string, Accent> = {
  add: "green",
  cart: "yellow",
  build: "cyan",
  prime: "purple",
  paint: "cyan",
  check: "green",
};

export function activityAccentFor(icon: string): Accent {
  return activityAccent[icon] ?? "dim";
}

/**
 * Per-stat-box accent (D5 / MM-49 — "give each tracker box's total its own
 * palette colour"). The four dashboard KPI boxes each read in a distinct
 * style-guide hue per Ross's tracker comments (qHYZN/4g3I/JxHyr), so the row
 * scans as four separate readouts:
 * Per Ross's per-stat colour calls (icu1mlFtJeya / awIApwrPCRs3 / zsgMLZrqO_ha /
 * _tsKQEEUbfvT):
 *   Active projects → cyan   (neon — a live readout)
 *   Completion %    → green  (neon — progress toward done)
 *   Streak         → yellow  (pastel — a streak you don't want to break)
 *   Time Total      → purple (pastel — base; flips red past a long session)
 */
export const statBoxAccents = {
  active: "cyan",
  completion: "green",
  streak: "yellow",
  time: "purple",
} as const satisfies Record<string, Accent>;

/** Minutes → "H:MM" for the dashboard time-total / focus totals. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Hue (0–360) of a #rrggbb colour — used to position swatches on the coverage map. */
export function hexHue(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
