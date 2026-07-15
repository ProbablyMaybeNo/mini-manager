import { describe, expect, test } from "vitest";
import {
  webApplicationJsonLd,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo/structuredData";

describe("structured data (C3)", () => {
  test("WebApplication has the expected type and no fabricated rating", () => {
    const d = webApplicationJsonLd();
    expect(d["@type"]).toBe("WebApplication");
    expect(d["url"]).toBe("https://www.mini-mainframe.com");
    // No aggregateRating / reviews — fabricating them violates Google policy.
    expect(d).not.toHaveProperty("aggregateRating");
    expect(d).not.toHaveProperty("review");
  });

  test("FAQPage carries Question/Answer entities", () => {
    const d = faqPageJsonLd();
    expect(d["@type"]).toBe("FAQPage");
    const entities = d["mainEntity"] as Array<Record<string, unknown>>;
    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0]!["@type"]).toBe("Question");
    expect(
      (entities[0]!["acceptedAnswer"] as Record<string, unknown>)["@type"],
    ).toBe("Answer");
  });

  test("Breadcrumb builds 1-indexed positions on the www origin", () => {
    const d = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Recipe Gallery", path: "/gallery" },
    ]);
    expect(d["@type"]).toBe("BreadcrumbList");
    const items = d["itemListElement"] as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ position: 1, item: "https://www.mini-mainframe.com/" });
    expect(items[1]).toMatchObject({
      position: 2,
      item: "https://www.mini-mainframe.com/gallery",
    });
  });

  test("neither WebApplication nor FAQ uses Recipe/HowTo schema", () => {
    expect(webApplicationJsonLd()["@type"]).not.toBe("Recipe");
    expect(faqPageJsonLd()["@type"]).not.toBe("HowTo");
  });
});
