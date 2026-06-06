/**
 * Phase-0 — StatusBar pure helpers (DESIGN_LANGUAGE §8).
 *
 * The functional top strip's formatting/labelling logic, kept testable
 * in a node env without a DOM. The live clock itself is exercised here
 * via formatClock; the SSR placeholder is pinned so a refactor can't
 * break hydration-safety.
 */
import { describe, expect, test } from "vitest";
import {
  CLOCK_PLACEHOLDER,
  FOCUS_NONE_LABEL,
  formatClock,
  isStreakActive,
  streakUnit,
} from "@/components/statusBarHelpers";

describe("formatClock — 24-hour HH:MM:SS, zero-padded", () => {
  test("pads every field", () => {
    const d = new Date(2026, 5, 6, 4, 7, 9);
    expect(formatClock(d)).toBe("04:07:09");
  });

  test("uses 24-hour clock (no AM/PM rollover)", () => {
    const d = new Date(2026, 5, 6, 23, 59, 59);
    expect(formatClock(d)).toBe("23:59:59");
  });

  test("midnight reads 00:00:00", () => {
    const d = new Date(2026, 5, 6, 0, 0, 0);
    expect(formatClock(d)).toBe("00:00:00");
  });

  test("output is always 8 chars (HH:MM:SS) — stable width for tabular-nums", () => {
    for (const d of [
      new Date(2026, 0, 1, 1, 2, 3),
      new Date(2026, 0, 1, 12, 34, 56),
      new Date(2026, 0, 1, 9, 0, 0),
    ]) {
      expect(formatClock(d)).toHaveLength(8);
    }
  });
});

describe("SSR/hydration placeholder", () => {
  test("placeholder matches the HH:MM:SS shape so layout never shifts", () => {
    expect(CLOCK_PLACEHOLDER).toBe("--:--:--");
    expect(CLOCK_PLACEHOLDER).toHaveLength(8);
  });
});

describe("streakUnit — singular/plural", () => {
  test("1 day is singular", () => {
    expect(streakUnit(1)).toBe("DAY");
  });

  test("0 and 2+ days are plural", () => {
    expect(streakUnit(0)).toBe("DAYS");
    expect(streakUnit(2)).toBe("DAYS");
    expect(streakUnit(14)).toBe("DAYS");
  });
});

describe("isStreakActive — lit only when the chain is alive", () => {
  test("0 is inactive", () => {
    expect(isStreakActive(0)).toBe(false);
  });

  test("1+ is active", () => {
    expect(isStreakActive(1)).toBe(true);
    expect(isStreakActive(30)).toBe(true);
  });
});

describe("Focus empty-state label", () => {
  test('reads "none set" when no focus project', () => {
    expect(FOCUS_NONE_LABEL).toBe("none set");
  });
});
