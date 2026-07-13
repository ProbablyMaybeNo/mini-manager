import Link from "next/link";
import { Chip, Panel } from "@/components/kit";
import type { Accent } from "@/lib/palette";
import type { MyGalleryCard } from "@/db/queries/gallerySubmissions";
import type { GalleryStatus } from "@/db/schema";

/** Painter-facing label + accent per moderation state. `none` never reaches
 *  the strip (filtered out of the query), but the map stays total. */
const STATUS_META: Record<GalleryStatus, { label: string; accent: Accent }> = {
  none: { label: "Draft", accent: "dim" },
  pending: { label: "Pending review", accent: "yellow" },
  approved: { label: "Listed", accent: "green" },
  rejected: { label: "Rejected", accent: "red" },
};

/**
 * A compact "Your cards" strip above the community grid — lets a signed-in
 * painter see the moderation status of every card they've submitted. Renders
 * nothing when the painter has no submissions.
 */
export function YourCardsStrip({
  cards,
}: {
  cards: ReadonlyArray<MyGalleryCard>;
}) {
  if (cards.length === 0) return null;

  return (
    <Panel label="YOUR CARDS" className="mb-8 p-4">
      <ul className="flex flex-col gap-2">
        {cards.map((card) => {
          const meta = STATUS_META[card.status];
          return (
            <li
              key={card.recipeId}
              className="flex items-center justify-between gap-3"
            >
              <Link
                href={`/recipes/${card.recipeId}`}
                className="min-w-0 flex-1 truncate font-body text-body text-fg hover:text-cyan-lite"
              >
                {card.name}
              </Link>
              <Chip accent={meta.accent} className="shrink-0">
                {meta.label}
              </Chip>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
