import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import type { Metadata } from "next";

/**
 * R2-13 — the shared-link surfaces must not unfurl under the generic site
 * title.
 *
 * The root layout declares a global `twitter:` block. Per the X cards spec
 * `twitter:*` takes precedence over `og:*` wherever both are present, and Next
 * REPLACES a declared metadata field rather than merging into the parent's — so
 * a page that overrides only `openGraph` keeps the layout's generic
 * `twitter:title` and presents as the product rather than as the thing being
 * shared. Verified live on `/r/<slug>`, `/gallery` and `/pricing` before the
 * fix.
 *
 * These are the assertions that keep it fixed: for every share surface,
 * `twitter:title` must equal `og:title`, `twitter:description` must equal
 * `og:description`, and neither may be the layout's generic copy. `card` is
 * asserted too — restating it is the price of the wholesale replacement, and
 * dropping it would trade a wrong title for a shrunken picture.
 */

const GENERIC_TITLE = "The Mini Mainframe — paint & project manager for miniatures";

vi.mock("@/db/queries/recipes", () => ({
  getRecipeBySlug: async (slug: string) =>
    slug === "ultramarines-classic"
      ? {
          id: "rec_1",
          name: "Ultramarines — Classic Blue",
          notesMd: null,
          slots: Array.from({ length: 7 }, (_, i) => ({
            id: `s${i}`,
            paintId: null,
            customColorHex: "#123456",
            technique: "base",
          })),
        }
      : null,
  getPaintMetaMap: async () => new Map(),
  listPublishedRecipes: async () => [],
}));
vi.mock("@/db/queries/gallerySubmissions", () => ({
  listMyGallerySubmissions: async () => [],
}));
vi.mock("@/auth", () => ({ auth: async () => null }));

const { generateMetadata } = await import("@/app/r/[slug]/page");
const { metadata: galleryMetadata } = await import("@/app/(app)/gallery/page");
const { metadata: pricingMetadata } = await import("@/app/(public)/pricing/page");

/** `Metadata["twitter"]` is a union of card shapes; every member carries an
 *  optional title/description, so read them through a narrow structural view
 *  rather than widening to `any`. */
function shareTags(meta: Metadata): {
  ogTitle: unknown;
  ogDescription: unknown;
  twitterTitle: unknown;
  twitterDescription: unknown;
  twitterCard: unknown;
} {
  const og = meta.openGraph as { title?: unknown; description?: unknown } | undefined;
  const tw = meta.twitter as
    | { title?: unknown; description?: unknown; card?: unknown }
    | undefined;
  return {
    ogTitle: og?.title,
    ogDescription: og?.description,
    twitterTitle: tw?.title,
    twitterDescription: tw?.description,
    twitterCard: tw?.card,
  };
}

function expectMirrored(meta: Metadata, expectedTitle: string): void {
  const t = shareTags(meta);
  expect(t.ogTitle).toBe(expectedTitle);
  expect(t.twitterTitle).toBe(t.ogTitle);
  expect(t.twitterDescription).toBe(t.ogDescription);
  expect(t.twitterTitle).not.toBe(GENERIC_TITLE);
  expect(t.twitterCard).toBe("summary_large_image");
}

describe("R2-13 — share surfaces carry their own twitter: block", () => {
  test("/r/<slug> mirrors og:title and og:description onto twitter:", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "ultramarines-classic" }),
    });
    expectMirrored(meta, "Ultramarines — Classic Blue · The Mini Mainframe");
    // The recipe's own description, not the product pitch.
    expect(shareTags(meta).twitterDescription).toBe(
      "A paint recipe shared via The Mini Mainframe — 7 slots.",
    );
  });

  test("/r/<slug> leaves images to the route's own opengraph-image file", async () => {
    // Setting `twitter.images` here would override the per-slug card (the
    // admin-approved gallery PNG, else a generated name+swatches fallback)
    // with whatever was hardcoded. Next merges the file-convention image in.
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "ultramarines-classic" }),
    });
    const tw = meta.twitter as { images?: unknown } | undefined;
    const og = meta.openGraph as { images?: unknown } | undefined;
    expect(tw?.images).toBeUndefined();
    expect(og?.images).toBeUndefined();
  });

  test("an unknown slug stays noindex and declares no share block", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "does-not-exist" }),
    });
    expect((meta.robots as { index?: boolean } | undefined)?.index).toBe(false);
    expect(meta.twitter).toBeUndefined();
  });

  test("/gallery mirrors og onto twitter", () => {
    expectMirrored(galleryMetadata, "Recipe Gallery — The Mini Mainframe");
  });

  test("/pricing declares both blocks — it previously declared neither", () => {
    expectMirrored(pricingMetadata, "Sponsor the Mainframe · The Mini Mainframe");
  });

  test("every page that declares openGraph owns a share image in its own segment", () => {
    // The trap this fix walked into once. Declaring `openGraph` on a page
    // REPLACES the parent's block — including the file-convention image it had
    // been inheriting from an ancestor segment. /pricing gained a correct
    // og:title and silently lost its picture, leaving a card that promises
    // `summary_large_image` and supplies nothing. A file-convention image in
    // the page's OWN segment survives the replacement; an inherited one does
    // not, and there is no path to point `openGraph.images` at, because Next
    // only serves the content-hashed URL.
    for (const segment of [
      "src/app/r/[slug]",
      "src/app/(public)/pricing",
      // R2-12 — /gallery emitted zero og:image / twitter:image tags while
      // still declaring `summary_large_image`: it sits in `(app)`, so it never
      // inherited the `(public)` group's card in the first place.
      "src/app/(app)/gallery",
    ]) {
      const dir = path.join(process.cwd(), segment);
      expect(
        existsSync(path.join(dir, "opengraph-image.tsx")),
        `${segment} declares openGraph, so it needs its own opengraph-image.tsx`,
      ).toBe(true);
    }
  });
});
