import { describe, expect, test } from "vitest";
import {
  amazonCurrencyForHost,
  gwCurrencyForHost,
  inferCategoryFromUrl,
} from "@/lib/scrape/util";

describe("inferCategoryFromUrl", () => {
  test.each([
    ["https://x.com/paints-hobby/foo", "Paint"],
    ["https://x.com/wash-something", "Paint"],
    ["https://x.com/primer-pack", "Paint"],
    ["https://x.com/brush-set", "Tool"],
    ["https://x.com/clippers", "Tool"],
    ["https://x.com/terrain/ruins", "Terrain"],
    ["https://x.com/scenery/walls", "Terrain"],
    ["https://x.com/bits/bolters", "Bits"],
    ["https://x.com/combat-patrol-orks", "Box"],
    ["https://x.com/kit/intercessors", "Box"],
  ])("'%s' → %s", (url, expected) => {
    expect(inferCategoryFromUrl(new URL(url))).toBe(expected);
  });

  test("unknown path returns undefined", () => {
    expect(inferCategoryFromUrl(new URL("https://x.com/something-else"))).toBeUndefined();
  });
});

describe("amazonCurrencyForHost", () => {
  test.each([
    ["amazon.com", "USD"],
    ["amazon.co.uk", "GBP"],
    ["amazon.de", "EUR"],
    ["amazon.fr", "EUR"],
    ["amazon.ca", "CAD"],
    ["amazon.com.au", "AUD"],
    ["amazon.co.jp", "JPY"],
    ["amazon.somewhere-else", "USD"],
  ])("%s → %s", (host, expected) => {
    expect(amazonCurrencyForHost(host)).toBe(expected);
  });
});

describe("gwCurrencyForHost", () => {
  test.each([
    ["uk.games-workshop.com", "GBP"],
    ["eu.games-workshop.com", "EUR"],
    ["de.games-workshop.com", "EUR"],
    ["jp.games-workshop.com", "JPY"],
    ["games-workshop.com", "USD"], // bare = US default
  ])("%s → %s", (host, expected) => {
    expect(gwCurrencyForHost(host)).toBe(expected);
  });
});
