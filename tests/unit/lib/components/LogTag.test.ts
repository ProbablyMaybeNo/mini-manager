import { describe, expect, test } from "vitest";
import {
  LOG_TAG_LABEL,
  LOG_TAG_COLOR,
  type LogTagVariant,
} from "@/components/ui/LogTag";

const ALL_VARIANTS: LogTagVariant[] = ["info", "okay", "warn", "err", "debg"];

describe("LOG_TAG_LABEL", () => {
  test("info renders INFO", () => {
    expect(LOG_TAG_LABEL.info).toBe("INFO");
  });

  test("okay renders OKAY", () => {
    expect(LOG_TAG_LABEL.okay).toBe("OKAY");
  });

  test("warn renders WARN", () => {
    expect(LOG_TAG_LABEL.warn).toBe("WARN");
  });

  test("err renders ERR", () => {
    expect(LOG_TAG_LABEL.err).toBe("ERR");
  });

  test("debg renders DEBG", () => {
    expect(LOG_TAG_LABEL.debg).toBe("DEBG");
  });

  test("all five variants are present", () => {
    for (const v of ALL_VARIANTS) {
      expect(LOG_TAG_LABEL).toHaveProperty(v);
    }
  });
});

describe("LOG_TAG_COLOR", () => {
  test("info maps to status-info (cyan)", () => {
    expect(LOG_TAG_COLOR.info).toContain("--status-info");
  });

  test("okay maps to status-ok (green)", () => {
    expect(LOG_TAG_COLOR.okay).toContain("--status-ok");
  });

  test("warn maps to status-warning (amber)", () => {
    expect(LOG_TAG_COLOR.warn).toContain("--status-warning");
  });

  test("err maps to status-danger (red)", () => {
    expect(LOG_TAG_COLOR.err).toContain("--status-danger");
  });

  test("debg maps to status-purple (P11.10 — pastel purple palette)", () => {
    expect(LOG_TAG_COLOR.debg).toContain("--status-purple");
  });

  test("all five variants have colour classes", () => {
    for (const v of ALL_VARIANTS) {
      expect(LOG_TAG_COLOR[v]).toBeTruthy();
    }
  });

  test("each colour class uses a CSS token (no raw hex)", () => {
    for (const v of ALL_VARIANTS) {
      expect(LOG_TAG_COLOR[v]).toMatch(/--\w/);
      expect(LOG_TAG_COLOR[v]).not.toMatch(/#[0-9a-fA-F]{3,}/);
    }
  });
});
