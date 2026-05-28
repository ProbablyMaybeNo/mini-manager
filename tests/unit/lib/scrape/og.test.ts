import { describe, expect, test } from "vitest";
import { parsePrice, parseOpenGraph } from "@/lib/scrape/og";

describe("parsePrice", () => {
  test("plain dollar amount", () => {
    expect(parsePrice("$12.99")).toBe(12.99);
  });

  test("pound amount with html-entity decoded symbol", () => {
    expect(parsePrice("£2.65")).toBe(2.65);
  });

  test("comma as thousands separator (US format)", () => {
    expect(parsePrice("$1,234.56")).toBe(1234.56);
  });

  test("comma as decimal separator (EU format)", () => {
    expect(parsePrice("1.234,56")).toBe(1234.56);
  });

  test("integer with no decimal", () => {
    expect(parsePrice("99")).toBe(99);
  });

  test("non-numeric returns undefined", () => {
    expect(parsePrice("free")).toBeUndefined();
  });

  test("empty string returns undefined", () => {
    expect(parsePrice("")).toBeUndefined();
  });
});

describe("parseOpenGraph", () => {
  const baseUrl = new URL("https://example.com/product/123");

  test("extracts title + image + price from canonical tags", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Test Product" />
        <meta property="og:image" content="https://example.com/img.jpg" />
        <meta property="og:price:amount" content="19.99" />
        <meta property="og:price:currency" content="usd" />
      </head></html>
    `;
    const r = parseOpenGraph(html, baseUrl);
    expect(r).not.toBeNull();
    expect(r?.title).toBe("Test Product");
    expect(r?.imageUrl).toBe("https://example.com/img.jpg");
    expect(r?.price).toBe(19.99);
    expect(r?.currency).toBe("USD");
    expect(r?.vendor).toBe("example.com");
  });

  test("supports product:price:* fallback", () => {
    const html = `
      <head>
        <meta property="og:title" content="X" />
        <meta property="product:price:amount" content="5.50" />
        <meta property="product:price:currency" content="GBP" />
      </head>
    `;
    expect(parseOpenGraph(html, baseUrl)?.price).toBe(5.5);
    expect(parseOpenGraph(html, baseUrl)?.currency).toBe("GBP");
  });

  test("falls back to <title> when og:title is absent", () => {
    const html = `<title>Plain Title</title>`;
    expect(parseOpenGraph(html, baseUrl)?.title).toBe("Plain Title");
  });

  test("returns null when no usable title exists", () => {
    expect(parseOpenGraph("<html></html>", baseUrl)).toBeNull();
  });

  test("strips leading www. from vendor hostname", () => {
    const html = `<meta property="og:title" content="X" />`;
    const r = parseOpenGraph(html, new URL("https://www.example.com/p/1"));
    expect(r?.vendor).toBe("example.com");
  });
});
