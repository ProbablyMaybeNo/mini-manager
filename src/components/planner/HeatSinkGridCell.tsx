import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getCoverageGridView,
  type CoverageGridView,
} from "@/db/queries/paintCoverage";
import { HeatSinkGridClient } from "./HeatSinkGridClient";

/**
 * P16.3 / P16.4 — HeatSink coverage grid widget.
 *
 * Renders the painter's paint catalog as a hue-sorted spectrum of tiny
 * squares: fill = each paint's stored hex, border = coverage state
 * (green owned / amber wanted / transparent none). The painter reads
 * their collection as a rainbow and sees the gaps at a glance.
 *
 * This is the server seam. It's an async server component that pulls
 * its own data on a no-args call (so the PLANNER section mounts the
 * unchanged `<HeatSinkGridCell />`): the composed grid, the brand list,
 * and the painter's saved `library_brand_filter` default. It hands that
 * frozen bundle to `HeatSinkGridClient`, which owns the interaction —
 * the brand-filter chips, the Condensed/Full toggle, and the
 * row-chunked render (P16.4 performance pass). `view` is a test seam.
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
    <Card title="COVERAGE" titleAs="h3" accentColor="green">
      <HeatSinkGridClient
        grid={resolved.grid}
        brands={resolved.brands}
        defaultBrandFilter={resolved.defaultBrandFilter}
      />
    </Card>
  );
}
