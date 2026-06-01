import { Card } from "@/components/ui/Card";

/**
 * P14.2 — Inspo gallery cell placeholder.
 *
 * Scaffold-only. The full widget (P14.7) renders a Notion-style
 * 3-or-4-column grid of `inspo_images.url` pastes for the current
 * user. NO fetch, NO storage, NO thumbnail generation — external
 * URL passthrough only (Pinterest / IG / ArtStation). Ross's
 * locked decision: paste-only, never re-open.
 */
export function PlannerInspoCell() {
  return (
    <Card title="INSPO" titleAs="h3" accentColor="cyan">
      <div className="frame p-3">
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
          Paste a URL from Pinterest, Instagram, or ArtStation to
          start your reference board.
        </p>
      </div>
    </Card>
  );
}
