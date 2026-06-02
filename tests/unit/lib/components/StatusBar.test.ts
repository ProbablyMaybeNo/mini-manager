import { describe, expect, test } from "vitest";
import {
  CLOCK_PLACEHOLDER,
  formatTime,
  LAG_THRESHOLD_MS,
  NET_LABEL,
  NET_TONE,
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

  test("OFF tooltip leads with the P15.4 'OFFLINE — cached data' framing", () => {
    // Offline reads are live — going offline is degraded-but-usable, so the
    // copy must tell the user cached data is still there, not just that
    // writes are blocked.
    expect(NET_TOOLTIP.OFF).toContain("OFFLINE — cached data");
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

describe("NET offline indicator (P15.4)", () => {
  // The offline indicator is the NET dot turning amber with an
  // "OFFLINE — cached data" tooltip. Lock the tone + label mapping so the
  // amber-not-red decision can't silently regress.
  test("OFF maps to the amber 'warning' tone, not red 'danger'", () => {
    // With offline reads live, offline is degraded-but-usable → amber.
    expect(NET_TONE.OFF).toBe("warning");
    expect(NET_TONE.OFF).not.toBe("danger");
  });

  test("warning tone resolves to the amber status-warning token", () => {
    expect(TONE_COLOR[NET_TONE.OFF]).toContain("--status-warning");
  });

  test("ON stays the green 'ok' tone", () => {
    expect(NET_TONE.ON).toBe("ok");
    expect(TONE_COLOR[NET_TONE.ON]).toContain("--status-ok");
  });

  test("LAG stays amber 'warning'", () => {
    expect(NET_TONE.LAG).toBe("warning");
  });

  test("OFF renders the fuller 'OFFLINE' label, not the terse 'OFF'", () => {
    expect(NET_LABEL.OFF).toBe("OFFLINE");
  });

  test("ON/LAG labels are unchanged", () => {
    expect(NET_LABEL.ON).toBe("ON");
    expect(NET_LABEL.LAG).toBe("LAG");
  });

  test("every NET state has a tone and a label", () => {
    for (const state of ["ON", "LAG", "OFF"] as const) {
      expect(NET_TONE[state]).toBeDefined();
      expect(NET_LABEL[state].length).toBeGreaterThan(0);
    }
  });
});

describe("StatusBar source — offline indicator reuses the status-dot pattern", () => {
  const src = require("node:fs").readFileSync(
    require("node:path").resolve(__dirname, "../../../../", "src/components/StatusBar.tsx"),
    "utf-8",
  ) as string;

  test("NET segment is driven by the NET_TONE / NET_LABEL maps, not an inline ternary", () => {
    expect(src).toContain("NET_TONE[net]");
    expect(src).toContain("value={NET_LABEL[net]}");
  });

  test("no raw hex colours introduced — amber comes from a theme token", () => {
    // Offline amber must be the --status-warning token, never a literal hex.
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
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
