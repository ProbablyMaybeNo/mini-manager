import { Card } from "@/components/ui/Card";

/**
 * P14.2 — Activity stream cell placeholder.
 *
 * Scaffold-only. The full widget (P14.4) reads `activity_log` for the
 * current user, renders the last 20 rows with kind glyph + time-ago
 * + resolved entity name. Ross signed off on the empty-state copy
 * the cell shows today so the section reads as intentional rather
 * than half-built.
 */
export function PlannerActivityCell() {
  return (
    <Card title="ACTIVITY" titleAs="h3" accentColor="green">
      <div className="frame p-3">
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
          No activity yet. Bump a stage or create a recipe to
          populate the stream.
        </p>
      </div>
    </Card>
  );
}
