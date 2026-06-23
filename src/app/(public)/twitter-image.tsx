// Reuse the Open Graph card for Twitter / X — identical 1200×630 CRT wordmark.
// Route-segment config (runtime/size/contentType/alt) must be statically
// declared here — Next can't statically parse a re-exported `runtime`, so we
// re-declare the config and only share the rendering component.
export const runtime = "edge";

export const alt =
  "The Mini Mainframe — Plan your projects. Track your paints. Manage your minis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "./opengraph-image";
