import { describe, expect, test } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  test("host + sitemap use the canonical www origin (C1)", () => {
    const r = robots();
    expect(r.host).toBe("https://www.mini-mainframe.com");
    expect(r.sitemap).toBe("https://www.mini-mainframe.com/sitemap.xml");
  });

  /**
   * S5 — both auth pages carry `robots: { index: false }`, so an explicit
   * `Allow` on them told the crawler to go and read a page that then tells it
   * not to index. Removed from `allow`, and deliberately NOT added to
   * `disallow`: a disallowed URL is never fetched, so the noindex directive
   * would never be read at all.
   */
  test("the noindex auth pages are neither allowed nor disallowed", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    for (const p of ["/sign-in", "/sign-up"]) {
      expect(rule?.allow, p).not.toContain(p);
      expect(rule?.disallow, p).not.toContain(p);
    }
    expect(rule?.allow).toContain("/");
  });

  test("disallows the api + signed-in app shell", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toContain("/api/");
    expect(rule?.disallow).toContain("/dashboard");
  });
});
