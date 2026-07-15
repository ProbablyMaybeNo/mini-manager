import { describe, expect, test } from "vitest";
import { AnalyticsEvent } from "@/lib/analytics/events";

describe("AnalyticsEvent (D2)", () => {
  test("defines the growth-loop, tool, extension and billing events", () => {
    const expected = [
      "share_card_downloaded",
      "gallery_view",
      "recipe_card_view",
      "recipe_cloned",
      "gallery_submit_started",
      "gallery_submit_completed",
      "tool_match_completed",
      "tool_result_saved",
      "extension_token_created",
      "billing_checkout_started",
      "billing_checkout_completed",
    ];
    const values = Object.values(AnalyticsEvent);
    for (const name of expected) {
      expect(values).toContain(name);
    }
  });

  test("every event name is unique", () => {
    const values = Object.values(AnalyticsEvent);
    expect(new Set(values).size).toBe(values.length);
  });
});
