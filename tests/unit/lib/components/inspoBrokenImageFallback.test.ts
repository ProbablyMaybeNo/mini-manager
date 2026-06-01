/**
 * UX-1103 — Inspo broken-image fallback.
 *
 * Both test inspo images in the audit (pinimg + unsplash) returned
 * 503 — the <img> ended with naturalWidth: 0 and rendered only alt
 * text floating in the gallery cell with no border / broken-image
 * glyph / error label. The fix:
 *
 *   - onError on every gallery <img> flips state → renders a framed
 *     fallback tile with the Lucide `ImageOff` icon + "Couldn't load
 *     — open source" link that opens the original URL in a new tab.
 *   - referrerPolicy="no-referrer" on the <img> to reduce 403s from
 *     Pinterest's hotlink protection.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("InspoGalleryGrid broken-image fallback (UX-1103)", () => {
  const src = read("src/components/planner/InspoGalleryGrid.tsx");

  test("imports the ImageOff icon from lucide-react", () => {
    expect(src).toMatch(/import \{ ImageOff \} from ["']lucide-react["']/);
  });

  test("every <img> has an onError handler", () => {
    expect(src).toMatch(/onError=\{\(\) => markBroken\(img\.id\)\}/);
  });

  test("every <img> has referrerPolicy='no-referrer' to mitigate Pinterest 403s", () => {
    expect(src).toMatch(/referrerPolicy=["']no-referrer["']/);
  });

  test("tracks broken state per-image via a Set keyed on InspoImage.id", () => {
    // Per-image, not global — one broken Pinterest URL must not blank
    // out the rest of the gallery.
    expect(src).toMatch(/brokenIds\.has\(img\.id\)/);
    expect(src).toMatch(/setBrokenIds/);
  });

  test("fallback tile renders the broken-image glyph + 'open source' link copy", () => {
    expect(src).toContain("ImageOff");
    expect(src).toMatch(/Couldn&apos;t load — open source/);
  });

  test("fallback link opens the original URL in a new tab with noopener", () => {
    // <a href={img.url} target="_blank" rel="noopener noreferrer" …>
    expect(src).toMatch(/href=\{img\.url\}/);
    expect(src).toMatch(/target=["']_blank["']/);
    expect(src).toMatch(/rel=["']noopener noreferrer["']/);
  });

  test("alt text becomes the fallback tile's hover title", () => {
    // title={altText} on the <a>, where altText falls back to "Inspo
    // reference" when img.altText is null.
    expect(src).toMatch(/title=\{altText\}/);
  });

  test("the fallback never calls fetch on the URL", () => {
    // Paste-only contract — even the fallback must never load the
    // image itself; the anchor only opens on user click.
    expect(src).not.toMatch(/\bfetch\(/);
  });

  test("fallback tile preserves the frame aesthetic (no raw hex)", () => {
    const hexLiteral = /#[0-9a-fA-F]{3,8}\b/;
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toMatch(hexLiteral);
  });

  test("lazy-loading preserved on the <img> (UX-1103 didn't drop it)", () => {
    expect(src).toMatch(/loading=["']lazy["']/);
  });
});
