import { describe, expect, test } from "vitest";
import { buildAcquisitionCookieValue } from "@/lib/acquisition";

describe("buildAcquisitionCookieValue", () => {
  test("captures ref alone", () => {
    const url = new URL("https://mini-mainframe.com/?ref=reddit-minipainting-0709");
    expect(buildAcquisitionCookieValue(url)).toBe(
      JSON.stringify({ ref: "reddit-minipainting-0709" }),
    );
  });

  test("captures ref + utm_* together", () => {
    const url = new URL(
      "https://mini-mainframe.com/?ref=disc&utm_source=discord&utm_medium=social&utm_campaign=launch",
    );
    expect(buildAcquisitionCookieValue(url)).toBe(
      JSON.stringify({
        ref: "disc",
        utm_source: "discord",
        utm_medium: "social",
        utm_campaign: "launch",
      }),
    );
  });

  test("returns null when no tracked params are present", () => {
    const url = new URL("https://mini-mainframe.com/dashboard");
    expect(buildAcquisitionCookieValue(url)).toBeNull();
  });

  test("strips unsafe characters and caps length", () => {
    const longUnsafe = `a<script>${"x".repeat(200)}`;
    const url = new URL(
      `https://mini-mainframe.com/?ref=${encodeURIComponent(longUnsafe)}`,
    );
    const result = JSON.parse(buildAcquisitionCookieValue(url)!);
    expect(result.ref).not.toMatch(/[<>]/);
    expect(result.ref.length).toBeLessThanOrEqual(120);
  });

  test("drops a field that sanitizes to an empty string", () => {
    const url = new URL(
      "https://mini-mainframe.com/?ref=%3C%3E&utm_source=discord",
    );
    const result = JSON.parse(buildAcquisitionCookieValue(url)!);
    expect(result.ref).toBeUndefined();
    expect(result.utm_source).toBe("discord");
  });
});
