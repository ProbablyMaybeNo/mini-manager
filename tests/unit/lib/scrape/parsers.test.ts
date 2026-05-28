import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elementgames } from "@/lib/scrape/parsers/elementgames";
import { nobleknight } from "@/lib/scrape/parsers/nobleknight";
import { miniaturemarket } from "@/lib/scrape/parsers/miniaturemarket";
import { gamekastle } from "@/lib/scrape/parsers/gamekastle";
import { gamersroll } from "@/lib/scrape/parsers/gamersroll";

const FIXTURES = join(__dirname, "..", "..", "..", "fixtures", "vendors");
const load = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

/**
 * Vendor parser regression suite. Each test runs a parser against a
 * cached real product page from that vendor and asserts the extracted
 * fields. When a parser stops extracting a field, the test goes red —
 * the failure is the EG-style "garbage row" bug we shipped in P2.5
 * and only caught at runtime.
 *
 * To add a new vendor: capture a real product page with a Chrome UA,
 * drop the HTML into tests/fixtures/vendors/<vendor>.html, write a
 * describe block. See TESTING.md.
 */

describe("elementgames parser", () => {
  const url = new URL(
    "https://elementgames.co.uk/paints-hobby-and-scenery/paints-hobby-and-scenery-by-manufacturer/ak-interactive/ak-acrylic-black-red-17ml",
  );
  const result = elementgames.parse(load("elementgames.html"), url);

  test("extracts the real product title (not the broken og:title)", () => {
    expect(result.title).toBe("AK Acrylic - Black Red 17ml - Ak Interactive");
  });

  test("extracts a real image URL (not the unsubstituted template)", () => {
    expect(result.imageUrl).toMatch(/\/images\/products\/\d+\/[^/]+-large\.jpg$/);
  });

  test("extracts GBP price", () => {
    expect(result.price).toBe(2.65);
    expect(result.currency).toBe("GBP");
  });

  test("infers Paint category from URL", () => {
    expect(result.category).toBe("Paint");
  });

  test("sets canonical vendor name", () => {
    expect(result.vendor).toBe("Element Games");
  });
});

describe("nobleknight parser", () => {
  const url = new URL("https://www.nobleknight.com/P/2147797047/Magenta-17ml");
  const result = nobleknight.parse(load("nobleknight.html"), url);

  test("tidies the doubled brand from og:title", () => {
    expect(result.title).toBe("Magenta (17ml) - Paint - AK-Interactive");
  });

  test("pulls the product image from twitter:image", () => {
    expect(result.imageUrl).toBe("https://image.nobleknight.com/a/jpg240/ak11067.jpg");
  });

  test("extracts USD price from Schema.org JSON-LD", () => {
    expect(result.price).toBe(4.95);
    expect(result.currency).toBe("USD");
  });

  test("sets canonical vendor name", () => {
    expect(result.vendor).toBe("Noble Knight Games");
  });
});

describe("miniaturemarket parser", () => {
  const url = new URL("https://www.miniaturemarket.com/amywp1491.html");
  const result = miniaturemarket.parse(load("miniaturemarket.html"), url);

  test("strips the category + site suffix from og:title", () => {
    expect(result.title).toBe("Warpaint: Metallic - Evil Chrome (18ml)");
  });

  test("extracts the og:image directly", () => {
    expect(result.imageUrl).toMatch(/miniaturemarket\.com\/media\/.*amywp1491\.jpg/);
  });

  test("extracts USD price from Magento dataLayer", () => {
    expect(result.price).toBe(3.99);
    expect(result.currency).toBe("USD");
  });
});

describe("gamekastle parser", () => {
  const url = new URL(
    "https://gamekastle.com/products/ak-interactive-quick-gen-acrylic-contrast-purple-flesh-18-ml",
  );
  const result = gamekastle.parse(load("gamekastle.html"), url);

  test("uses og:title directly (Shopify default is clean)", () => {
    expect(result.title).toBe(
      "AK-Interactive: Quick Gen Acrylic Contrast - Purple Flesh 18 ml",
    );
  });

  test("converts Shopify cents integer to dollars", () => {
    expect(result.price).toBe(5.25);
    expect(result.currency).toBe("USD");
  });

  test("prefers og:image:secure_url over og:image", () => {
    expect(result.imageUrl).toMatch(/^https:\/\/gamekastle\.com\/cdn\/shop/);
  });
});

describe("gamersroll parser", () => {
  const url = new URL(
    "https://www.gamersroll.com/army-painter/tapwp3001-army-painter-warpaints-fanatic-matt-black-18ml.html",
  );
  const result = gamersroll.parse(load("gamersroll.html"), url);

  test("derives title from <title> tag (og:title is absent)", () => {
    // numeric / hex entities &#x20; &#x3A; must be decoded
    expect(result.title).toBe(
      "TAPWP3001 Army Painter Warpaints Fanatic: Matt Black 18ml",
    );
  });

  test("extracts og:price:amount", () => {
    expect(result.price).toBe(3.47);
    expect(result.currency).toBe("USD");
  });

  test("extracts og:image", () => {
    expect(result.imageUrl).toMatch(/gamersroll\.com\/media\/catalog\/product/);
  });
});
