import { Card } from "@/components/ui/Card";

/**
 * P14.2 — Heatmap cell placeholder.
 *
 * Scaffold-only. The full widget (P14.6) renders a 90-day grid of
 * activity-count cells coloured by intensity. For now we render a
 * narrow strip of empty cells so the layout reserves the right
 * vertical room and reads as "data soon" rather than "broken".
 */
export function PlannerHeatmapCell() {
  return (
    <Card title="HEATMAP" titleAs="h3" accentColor="yellow">
      <div className="frame p-3 space-y-2">
        <div
          className="grid gap-[2px] w-full"
          style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
          aria-hidden
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="aspect-square rounded-[2px] bg-[color-mix(in_srgb,var(--color-fg-muted)_15%,transparent)]"
            />
          ))}
        </div>
        <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
          Your last 30 days of painting will fill in here.
        </p>
      </div>
    </Card>
  );
}
