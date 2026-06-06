/**
 * Pure helpers for the functional StatusBar (DESIGN_LANGUAGE §8).
 *
 * Kept outside the client component so the formatting + labelling logic
 * is unit-testable in a node env without a DOM / React renderer (same
 * split as dashboardKpiHelpers.ts / plannerStreakHelpers.ts).
 */

/** The clock placeholder shown on the server + first client render, before
 *  the live time is set in an effect. Keeps SSR and first client paint
 *  byte-identical so React never reports a hydration mismatch. */
export const CLOCK_PLACEHOLDER = "--:--:--";

/** Zero-padded 24-hour `HH:MM:SS`. Locale-independent so the placeholder →
 *  client swap is deterministic regardless of the user's locale. */
export function formatClock(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "DAY" for a 1-day streak, "DAYS" otherwise. */
export function streakUnit(streak: number): string {
  return streak === 1 ? "DAY" : "DAYS";
}

/** Whether the streak stat should read as "lit" (active) phosphor. */
export function isStreakActive(streak: number): boolean {
  return streak >= 1;
}

/** The Focus label shown when no focus project is set. */
export const FOCUS_NONE_LABEL = "none set";
