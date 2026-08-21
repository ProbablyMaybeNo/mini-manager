// R2-13 again — same trap /pricing hit, same fix.
//
// This page declares its own `openGraph` block so a shared link unfurls with
// the page's title instead of the generic product one. Next REPLACES a declared
// field rather than merging it into the parent's, so declaring `openGraph` drops
// the `(public)` group's inherited card and leaves a summary_large_image with no
// image at all. A file-convention image in the page's OWN segment survives that,
// because it merges into the page's metadata rather than the layout's.
//
// Re-exported, not redrawn: these pages should show the same branded card as the
// homepage, and /opengraph-image is not addressable as a plain path (Next serves
// only the content-hashed URL), so there is nothing to point `openGraph.images`
// at. Route-segment config must be statically declared here — Next can't parse a
// re-exported `runtime` — so only the rendering component is shared.
export const runtime = "edge";

export const alt =
  "The Mini Mainframe — Plan your projects. Track your paints. Manage your minis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "../opengraph-image";
