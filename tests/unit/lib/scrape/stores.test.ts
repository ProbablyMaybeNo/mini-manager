import { describe, expect, test } from "vitest";
import {
  SUPPORTED_STORES,
  SUPPORTED_STORE_NAMES,
  isSupportedStoreUrl,
  matchSupportedStore,
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
