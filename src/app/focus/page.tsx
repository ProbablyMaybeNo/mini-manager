import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Focus · Mini Manager",
};

/**
 * FOCUS (/focus) — route scaffold (FIGMA-REBUILD foundation).
 *
 * TODO(focus agent, task #8): build the full page per REBUILD_SPEC §7 +
 * docs/redesign-refs/Focus.png — project bar (`PROJECT NAME ×QTY`),
 * recipe-step cards row (solid paint fill + black text), NOTES panel,
 * session row (stopwatch + START/STOP + LOG | PROGRESS BAR with model
 * counter + % band colour), INSPIRATION panel (paste-URL add + thumbnail
 * row + lightbox). Launch context: `/focus?project=…` or last-active.
 * Mine the pre-rebuild bench (src/components/focus/* — Stopwatch,
 * FocusPanel, RecipeTabs, InspoLightbox wiring) for logic, not layout.
 */
export default function FocusPage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <PageHeader
        title="FOCUS"
        accent="cyan"
        tagline="Painting session companion — timer, recipe steps and inspiration in one place."
      />
      <Panel
        variant="cyan"
        ticks
        label="SYS · FOCUS"
        className="mt-8 p-8 text-center"
      >
        <p className="font-mono text-sm text-[var(--color-fg)]">
          NO SESSION LOADED — LAUNCH FOCUS FROM A PROJECT ON THE DASHBOARD.
        </p>
        <div className="mt-6 flex justify-center">
          <Button as="a" href="/projects" variant="primary" size="md">
            GO TO DASHBOARD
          </Button>
        </div>
      </Panel>
    </div>
  );
}
