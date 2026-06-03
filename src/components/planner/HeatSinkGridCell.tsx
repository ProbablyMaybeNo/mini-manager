import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getCoverageGridView,
  type CoverageGridView,
} from "@/db/queries/paintCoverage";
import { HeatSinkGridClient } from "./HeatSinkGridClient";

/**
 * P16.3 / P16.4 / A — the COLLECTION map widget (was "Coverage").
 *
 * Renders the painter's paint catalog as a hue-sorted spectrum of
 * literally-pixel-sized cells: fill = each paint's stored hex, with a
 * sparse approximate overlay of dots marking owned (green) / wishlisted
 * (yellow) paints (A2). The painter reads their COLLECTION as a rainbow
 * and sees the gaps at a glance. A4 renamed the user-visible "Coverage"
 * label to "COLLECTION" (working title — trivial to re-label).
 *
 * This is the server seam. It's an async server component that pulls
 * its own data on a no-args call (so the PLANNER section mounts the
 * unchanged `<HeatSinkGridCell />`): the composed grid, the brand list,
 * and the painter's saved `library_brand_filter` default. It hands that
 * frozen bundle to `HeatSinkGridClient`, which owns the interaction —
 * the brand-filter chips and the row-chunked render (P16.4 performance
 * pass). `view` is a test seam.
 *
 * A3 — this is now the hero in the big left cell (square-aspect), so the
 * Card stretches to fill the square and the spectrum scrolls inside it.
 *
 * Mirrors the other planner widgets' split (e.g. `PlannerInspoCell` →
 * `InspoGalleryGrid`): server fetches, client interacts.
 */

interface Props {
  /** Optional pre-composed view bundle. When omitted the cell pulls the
   *  current user's grid + brands + default filter. Tests pin this for
   *  determinism. */
  view?: CoverageGridView;
}

export async function HeatSinkGridCell({ view }: Props = {}) {
  const resolved =
    view ?? (await getCoverageGridView(await currentUserId()));

  return (
    <Card
      title="COLLECTION"
      titleAs="h3"
      accentColor="green"
      className="md:h-full md:flex md:flex-col"
      bodyClassName="md:flex-1 md:min-h-0 md:overflow-hidden"
    >
      <HeatSinkGridClient
        grid={resolved.grid}
        brands={resolved.brands}
        defaultBrandFilter={resolved.defaultBrandFilter}
      />
    </Card>
  );
}
