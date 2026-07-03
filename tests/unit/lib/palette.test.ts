import { describe, expect, test } from "vitest";
import {
  activityAccent,
  activityAccentFor,
  eventKindAccent,
  statBoxAccents,
} from "@/lib/palette";

/**
 * D5 — activity entries are colour-coded by type and each tracker box's total
 * gets its own palette colour. These tests pin the mappings so a future palette
 * tweak is a deliberate, reviewed change rather than a silent drift.
 */
describe("activityAccentFor — colour-code activity by type (MM-45 · §8)", () => {
  test("keeps a hue only on the signal-carrying moves; the rest go neutral", () => {
    expect(activityAccentFor("add")).toBe("neutral");
    expect(activityAccentFor("cart")).toBe("yellow");
    expect(activityAccentFor("build")).toBe("neutral");
    expect(activityAccentFor("prime")).toBe("neutral");
    expect(activityAccentFor("paint")).toBe("neutral");
    expect(activityAccentFor("check")).toBe("green");
  });

  test("falls back to dim for an unknown icon key (never crashes the feed)", () => {
    expect(activityAccentFor("nope")).toBe("dim");
    expect(activityAccentFor("")).toBe("dim");
  });

  test("carries only the calmed signal hues — no retired purple", () => {
    const used = new Set(Object.values(activityAccent));
    expect(used.has("yellow")).toBe(true);
    expect(used.has("green")).toBe(true);
    expect(used.has("neutral")).toBe(true);
    expect(used.has("purple")).toBe(false);
  });
});

describe("statBoxAccents — per-tracker-box total colours (MM-49)", () => {
  test("each of the four KPI boxes reads in its own hue", () => {
    expect(statBoxAccents.active).toBe("cyan");
    expect(statBoxAccents.completion).toBe("green");
    expect(statBoxAccents.streak).toBe("yellow");
    expect(statBoxAccents.time).toBe("neutral");
  });

  test("the four accents are all distinct", () => {
    const accents = Object.values(statBoxAccents);
    expect(new Set(accents).size).toBe(accents.length);
  });
});

describe("eventKindAccent — calendar tag colours (D1)", () => {
  test("each event kind maps to a style-guide accent", () => {
    expect(eventKindAccent.tournament).toBe("cyan");
    expect(eventKindAccent.deadline).toBe("red");
    expect(eventKindAccent.battle).toBe("yellow");
    expect(eventKindAccent.other).toBe("green");
  });
});
