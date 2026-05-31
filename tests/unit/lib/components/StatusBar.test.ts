import { describe, expect, test } from "vitest";
import {
  CLOCK_PLACEHOLDER,
  formatTime,
  SSR_NET_STATUS,
  TONE_COLOR,
} from "@/components/StatusBar";

describe("formatTime", () => {
  test("formats midnight correctly", () => {
    const d = new Date(2024, 0, 1, 0, 0, 0);
    // Locale-aware — just verify the colon-separated HH:MM:SS shape.
    expect(formatTime(d)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test("formats noon correctly", () => {
    const d = new Date(2024, 0, 1, 12, 30, 45);
    expect(formatTime(d)).toMatch(/12:30:45/);
  });

  test("zero-pads single-digit seconds", () => {
    const d = new Date(2024, 0, 1, 9, 5, 7);
    // hour12:false → "09:05:07"
    expect(formatTime(d)).toMatch(/:\d{2}$/);
  });

  test("returns a string of length 8 (HH:MM:SS)", () => {
    const d = new Date(2024, 0, 1, 14, 22, 9);
    expect(formatTime(d)).toHaveLength(8);
  });
});

describe("TONE_COLOR", () => {
  test("ok maps to status-ok token", () => {
    expect(TONE_COLOR.ok).toContain("--status-ok");
  });

  test("warning maps to status-warning token", () => {
    expect(TONE_COLOR.warning).toContain("--status-warning");
  });

  test("danger maps to status-danger token", () => {
    expect(TONE_COLOR.danger).toContain("--status-danger");
  });

  test("info maps to status-info token", () => {
    expect(TONE_COLOR.info).toContain("--status-info");
  });

  test("neutral maps to fg-muted token", () => {
    expect(TONE_COLOR.neutral).toContain("--color-fg-muted");
  });

  test("all five variants are mapped", () => {
    const keys = Object.keys(TONE_COLOR);
    expect(keys).toContain("ok");
    expect(keys).toContain("warning");
    expect(keys).toContain("danger");
    expect(keys).toContain("info");
    expect(keys).toContain("neutral");
  });
});

describe("SSR determinism contract", () => {
  // These first-render values must be constants — never derived from
  // `navigator`, `Date`, or anything that differs server vs client — or
  // StatusBar reintroduces the NET-status hydration mismatch.
  test("net status defaults to the optimistic ON", () => {
    expect(SSR_NET_STATUS).toBe("ON");
  });

  test("clock placeholder is a static HH:MM:SS-shaped string", () => {
    expect(CLOCK_PLACEHOLDER).toBe("--:--:--");
    expect(CLOCK_PLACEHOLDER).toHaveLength(8);
  });
});
