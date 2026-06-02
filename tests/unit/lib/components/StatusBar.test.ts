import { describe, expect, test } from "vitest";
import {
  CLOCK_PLACEHOLDER,
  formatTime,
  LAG_THRESHOLD_MS,
  NET_TOOLTIP,
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

describe("NET_TOOLTIP (UX-911)", () => {
  // Recruits seeing NET LAG flash amber would worry their save just
  // failed. The amber tooltip has to explicitly reassure them that
  // their work is still saving. Lock the copy here so a future
  // refactor doesn't quietly drop the reassurance.
  test("LAG tooltip explicitly reassures the user their work is still saving", () => {
    expect(NET_TOOLTIP.LAG.toLowerCase()).toContain("still saving");
  });

  test("OFF tooltip warns that changes won't save", () => {
    expect(NET_TOOLTIP.OFF.toLowerCase()).toContain("won't save");
  });

  test("ON tooltip describes normal connectivity", () => {
    expect(NET_TOOLTIP.ON.toLowerCase()).toContain("normally");
  });

  test("all three NET states are mapped", () => {
    expect(Object.keys(NET_TOOLTIP).sort()).toEqual(["LAG", "OFF", "ON"]);
  });

  test("no tooltip is empty", () => {
    for (const key of Object.keys(NET_TOOLTIP) as Array<keyof typeof NET_TOOLTIP>) {
      expect(NET_TOOLTIP[key].length).toBeGreaterThan(10);
    }
  });
});

describe("LAG_THRESHOLD_MS (UX-1002)", () => {
  // Vercel free-tier cold starts routinely take ~1.3-1.8s. Threshold must
  // sit above that band so otherwise-healthy sessions don't flash amber.
  test("threshold is at least 2000ms to clear Vercel cold-start band", () => {
    expect(LAG_THRESHOLD_MS).toBeGreaterThanOrEqual(2000);
  });

  test("threshold is a finite positive number", () => {
    expect(Number.isFinite(LAG_THRESHOLD_MS)).toBe(true);
    expect(LAG_THRESHOLD_MS).toBeGreaterThan(0);
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
