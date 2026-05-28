import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { scrapeUrl } from "@/lib/scrape";

/**
 * Dispatcher routing — verifies that scrapeUrl picks the right vendor
 * parser by hostname (the actual extraction is covered per-parser in
 * parsers.test.ts). Fetch is mocked to return a tiny page with usable
 * OG metadata so the dispatcher exercises real branches without going
 * to the network.
 */

const MINIMAL_HTML = `
  <html><head>
    <meta property="og:title" content="Stubbed Product" />
    <meta property="og:image" content="https://example.com/img.jpg" />
    <meta property="og:price:amount" content="9.99" />
    <meta property="og:price:currency" content="USD" />
  </head></html>
`;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      text: async () => MINIMAL_HTML,
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrapeUrl dispatcher", () => {
  test.each([
    ["https://www.elementgames.co.uk/some/product", "Element Games"],
    ["https://elementgames.co.uk/some/product", "Element Games"],
    ["https://waylandgames.co.uk/some/product", "Wayland Games"],
    ["https://goblingaming.co.uk/some/product", "Goblin Gaming"],
    ["https://www.games-workshop.com/some/product", "Games Workshop"],
    ["https://www.amazon.com/dp/B000FOO", "Amazon"],
    ["https://www.amazon.co.uk/dp/B000FOO", "Amazon"],
    ["https://www.ebay.com/itm/123", "eBay"],
    ["https://www.nobleknight.com/P/123/foo", "Noble Knight Games"],
    ["https://www.miniaturemarket.com/abc.html", "Miniature Market"],
    ["https://gamekastle.com/products/foo", "Game Kastle"],
    ["https://www.gamersroll.com/foo.html", "Gamers Roll"],
  ])("routes %s to the right vendor", async (url, expectedVendor) => {
    const result = await scrapeUrl(new URL(url));
    expect(result).not.toBeNull();
    expect(result!.vendor).toBe(expectedVendor);
  });

  test("unknown vendor falls back to OG parser using hostname as vendor", async () => {
    const result = await scrapeUrl(new URL("https://some-random-store.io/p/1"));
    expect(result).not.toBeNull();
    expect(result!.vendor).toBe("some-random-store.io");
    expect(result!.title).toBe("Stubbed Product");
  });

  test("returns null when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        text: async () => "",
      })) as unknown as typeof fetch,
    );
    const result = await scrapeUrl(new URL("https://unknown.example/p"));
    expect(result).toBeNull();
  });

  test("returns null when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }) as unknown as typeof fetch,
    );
    const result = await scrapeUrl(new URL("https://unknown.example/p"));
    expect(result).toBeNull();
  });
});
