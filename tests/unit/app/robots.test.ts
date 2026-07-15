import { describe, expect, test } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  test("host + sitemap use the canonical www origin (C1)", () => {
    const r = robots();
    expect(r.host).toBe("https://www.mini-mainframe.com");
    expect(r.sitemap).toBe("https://www.mini-mainframe.com/sitemap.xml");
  });

  test("disallows the api + signed-in app shell", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toContain("/api/");
    expect(rule?.disallow).toContain("/dashboard");
  });
});
