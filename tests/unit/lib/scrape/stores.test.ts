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
    expect(matchSupportedStore("https://www.games-workshop.com/foo")?.name).toBe(
      "Games Workshop",
    );
  });

  test("matches a supported store on a subdomain", () => {
    expect(matchSupportedStore("https://us.games-workshop.com/x")?.name).toBe(
      "Games Workshop",
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

describe("storeLabelForUrl — naming the host a failed scrape came from (R2-4)", () => {
  test("prefers the registered store's display name", () => {
    expect(storeLabelForUrl("https://www.games-workshop.com/en-GB/thing")).toBe(
      "Games Workshop",
    );
    expect(storeLabelForUrl("https://us.games-workshop.com/x")).toBe(
      "Games Workshop",
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
