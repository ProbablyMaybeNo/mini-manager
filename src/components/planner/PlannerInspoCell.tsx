import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  listAllInspoImages,
  listDisplayedInspoImages,
} from "@/db/queries/inspoImages";
import { InspoGalleryGrid } from "./InspoGalleryGrid";

/**
 * P14.7 — Inspo gallery cell.
 *
 * Async server component. Fetches the painter's displayed + full
 * inspo lists for the current user and hands them to the grid +
 * Manage modal. The widget is paste-only: external URLs the painter
 * grabs from Pinterest / Instagram / ArtStation render straight via
 * `<img src={url}>`. NO fetch, NO storage, NO thumbnails — Ross's
 * locked decision, do not re-open.
 *
 * Empty state preserves the scaffold copy Ross signed off on:
 *   "Paste a URL from Pinterest, Instagram, or ArtStation to start
 *    your reference board."
 */
export async function PlannerInspoCell() {
  const userId = await currentUserId();
  const [displayed, all] = await Promise.all([
    listDisplayedInspoImages(userId),
    listAllInspoImages(userId),
  ]);

  return (
    <Card title="INSPO" titleAs="h3" accentColor="cyan">
      <InspoGalleryGrid displayed={displayed} all={all} />
    </Card>
  );
}
