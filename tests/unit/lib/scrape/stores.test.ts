import { describe, expect, test } from "vitest";
import {
  SUPPORTED_STORES,
  SUPPORTED_STORE_NAMES,
  isSupportedStoreUrl,
  matchSupportedStore,
  storeLabelForUrl,
} from "@/lib/scrape/stores";

describe("supported store registry (MM-40)", () => {
  test("exposes a non-empty, de-duplicated display-name list", () => {
    expect(SUPPORTED_STORE_NAMES.length).toBeGreaterThan(0);
    expect(new Set(SUPPORTED_STORE_NAMES).size).toBe(SUPPORTED_STORE_NAMES.length);
  });

  test("matches a known store by exact host", () => {
    expect(matchSupportedStore("https://www.elementgames.co.uk/foo")?.name).toBe(
      "Element Games",
    );
  });

  test("matches a supported store on a subdomain", () => {
    expect(matchSupportedStore("https://shop.elementgames.co.uk/x")?.name).toBe(
      "Element Games",
    );
  });

  test("flags an unsupported store URL", () => {
    expect(isSupportedStoreUrl("https://totally-random-shop.example/p")).toBe(false);
    expect(matchSupportedStore("https://totally-random-shop.example/p")).toBeNull();
  });

  test("never throws on malformed input", () => {
    expect(matchSupportedStore("not a url")).toBeNull();
    expect(isSupportedStoreUrl("")).toBe(false);
  });

  test("every registered store carries at least one hostname", () => {
    for (const store of SUPPORTED_STORES) {
      expect(store.hostnames.length).toBeGreaterThan(0);
    }
  });
});

/**
 * R3-2 — the list is a promise to the painter, so a host that cannot be read
 * must not appear on it. Live server-side fetches from a datacentre IP: GW
 * answers 403 then a 202 AWS WAF JavaScript challenge, Goblin Gaming and Game
 * Kastle both 429 immediately. Nothing about the parsers changed; the network
 * did. Guarding it here so nobody re-advertises them without re-testing.
 */
describe("R3-2 delisted hosts are not advertised as auto-fill stores", () => {
  test.each([
    "https://www.games-workshop.com/en-GB/some-kit",
    "https://goblingaming.co.uk/products/foo",
    "https://gamekastle.com/products/foo",
  ])("%s is not a supported store", (url) => {
    expect(matchSupportedStore(url)).toBeNull();
    expect(isSupportedStoreUrl(url)).toBe(false);
  });

  test.each(["Games Workshop", "Goblin Gaming", "Game Kastle"])(
    "%s is absent from the advertised names",
    (name) => {
      expect(SUPPORTED_STORE_NAMES).not.toContain(name);
    },
  );

  test("the four stores Ross ruled in, plus Gamers Roll, still resolve", () => {
    const kept: ReadonlyArray<readonly [string, string]> = [
      ["https://www.elementgames.co.uk/p/1", "Element Games"],
      ["https://www.waylandgames.co.uk/p/1", "Wayland Games"],
      ["https://www.nobleknight.com/P/1/x", "Noble Knight Games"],
      ["https://www.miniaturemarket.com/x.html", "Miniature Market"],
      ["https://www.gamersroll.com/x.html", "Gamers Roll"],
    ];
    for (const [url, name] of kept) {
      expect(matchSupportedStore(url)?.name).toBe(name);
    }
  });
});

describe("storeLabelForUrl — naming the host a failed scrape came from (R2-4)", () => {
  test("prefers the registered store's display name", () => {
    expect(storeLabelForUrl("https://www.elementgames.co.uk/en-GB/thing")).toBe(
      "Element Games",
    );
    expect(storeLabelForUrl("https://shop.elementgames.co.uk/x")).toBe(
      "Element Games",
    );
  });

  test("a delisted host falls back to its bare hostname, so the row is still named", () => {
    // The whole point of R3-2 is that this URL now takes the couldn't-auto-read
    // path instead of being advertised as supported — the painter still gets a
    // row seeded with a usable vendor, just not a promise we can't keep.
    expect(storeLabelForUrl("https://www.games-workshop.com/en-GB/thing")).toBe(
      "games-workshop.com",
    );
  });

  test("falls back to the bare hostname for an unknown store", () => {
    // The couldn't-auto-read row still gets a useful vendor this way.
    expect(storeLabelForUrl("https://www.some-shop.example/p/1")).toBe(
      "some-shop.example",
    );
  });

  test("returns null rather than throwing on unusable input", () => {
    expect(storeLabelForUrl("not a url")).toBeNull();
    expect(storeLabelForUrl("")).toBeNull();
  });
});
