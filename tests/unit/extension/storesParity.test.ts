import { describe, expect, test } from "vitest";
import { SUPPORTED_STORE_LINKS } from "@/lib/scrape/stores";
// @ts-expect-error — plain JS, no build step, no types. Imported for parity only.
import { SUPPORTED_STORES as EXTENSION_STORES } from "../../../extension/stores.js";

/**
 * The browser extension's popup renders the supported-store list from its own
 * copy in `extension/stores.js`, because it needs the list before it has made
 * any request — right after the token is saved, and on a tab whose URL never
 * reaches the server.
 *
 * That copy is the drift risk. Stores get delisted for real reasons (three went
 * on 2026-08-04 when live fetches proved they could not be read; Amazon and eBay
 * followed on 2026-08-05), and a stale copy inside a published, Web-Store-hosted
 * extension is worse than a stale one in the app: users can't refresh it, and it
 * promises a fill the server will refuse.
 *
 * So this asserts exact parity — same names, same order, same URLs.
 */
describe("extension store list mirrors the server", () => {
  const server = SUPPORTED_STORE_LINKS.map((s) => ({ name: s.name, url: s.url }));
  const extension = EXTENSION_STORES as ReadonlyArray<{ name: string; url: string }>;

  test("names and URLs match exactly, in the same order", () => {
    expect(extension).toEqual(server);
  });

  test("the server list is non-empty (a passing empty-vs-empty match proves nothing)", () => {
    expect(server.length).toBeGreaterThan(0);
  });
});
