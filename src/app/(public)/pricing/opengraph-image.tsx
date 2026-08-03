// R2-13 — /pricing needs its own copy of the root card, in its own segment.
//
// It previously inherited the `(public)` group's card for free, because a page
// that declares no `openGraph` of its own inherits the parent's whole block,
// image included. Giving /pricing a real `og:title` means declaring that block
// — and Next REPLACES a declared field rather than merging into the parent's,
// which dropped the inherited image and left a large-image card with no image.
// A file-convention image in the page's own segment survives that, because it
// merges into the page's own metadata rather than the layout's.
//
// Re-exported rather than redrawn: the pricing link should show the same
// branded card as the homepage, and /opengraph-image is not addressable as a
// plain path (Next only serves the content-hashed URL), so there is nothing to
// point `openGraph.images` at. Same idiom as (public)/twitter-image.tsx —
// route-segment config must be statically declared here, so only the rendering
// component is shared.
export const runtime = "edge";

export const alt =
  "The Mini Mainframe — Plan your projects. Track your paints. Manage your minis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "../opengraph-image";
