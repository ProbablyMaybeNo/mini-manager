import { notFound } from "next/navigation";
import { KitGalleryView } from "./KitGalleryView";

/**
 * Dev-only kit gallery — the presentational-component kitchen sink + a
 * jump list of every page/state. Lived at `/gallery` historically; moved
 * under `/dev/*` (the dev-only convention, alongside the Theme Studio) so
 * the public `/gallery` route is free for the published-recipe gallery.
 * 404s in production.
 */
export default function KitGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitGalleryView />;
}
