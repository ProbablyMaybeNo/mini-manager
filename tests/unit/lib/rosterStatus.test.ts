import { describe, expect, test } from "vitest";
import {
  projectMatchesRoster,
  rosterStatusOf,
  sortRoster,
} from "@/lib/rosterStatus";
import type { Project } from "@/lib/types";

const proj = (overrides: Partial<Project> = {}): Project => ({
  id: "p1",
  title: "Test",
  type: "Unit",
  recipeSwatches: [],
  status: "PAINTING",
  priority: "Med",
  completionPercent: 50,
  ...overrides,
});

const TODAY = "2026-06-28";

describe("rosterStatusOf", () => {
  test("DONE when complete by percent or status", () => {
    expect(rosterStatusOf(proj({ completionPercent: 100 }), undefined, TODAY)).toBe("DONE");
    expect(
      rosterStatusOf(proj({ completionPercent: 40, status: "COMPLETE" }), undefined, TODAY),
    ).toBe("DONE");
  });

  test("NEARLY DONE in the 80–99% band", () => {
    expect(rosterStatusOf(proj({ completionPercent: 80 }), undefined, TODAY)).toBe("NEARLY DONE");
    expect(rosterStatusOf(proj({ completionPercent: 99 }), undefined, TODAY)).toBe("NEARLY DONE");
  });

  test("ON HOLD when shelved (and not done)", () => {
    expect(
      rosterStatusOf(proj({ status: "SHELVED", completionPercent: 30 }), undefined, TODAY),
    ).toBe("ON HOLD");
  });

  test("PLANNED when not started (0% + wishlist/owned)", () => {
    expect(
      rosterStatusOf(proj({ completionPercent: 0, status: "WISHLIST" }), undefined, TODAY),
    ).toBe("PLANNED");
    expect(
      rosterStatusOf(proj({ completionPercent: 0, status: "OWNED" }), undefined, TODAY),
    ).toBe("PLANNED");
  });

  test("IN PROGRESS otherwise", () => {
    expect(rosterStatusOf(proj({ completionPercent: 50 }), undefined, TODAY)).toBe("IN PROGRESS");
  });

  test("OVERDUE when a past deadline is supplied and not done", () => {
    expect(rosterStatusOf(proj(), { p1: "2026-06-01" }, TODAY)).toBe("OVERDUE");
    // A future deadline is NOT overdue.
    expect(rosterStatusOf(proj(), { p1: "2026-07-01" }, TODAY)).toBe("IN PROGRESS");
    // DONE wins over a past deadline.
    expect(
      rosterStatusOf(proj({ completionPercent: 100 }), { p1: "2026-06-01" }, TODAY),
    ).toBe("DONE");
  });
});

describe("projectMatchesRoster", () => {
  test("a container matches if any descendant matches", () => {
    const army = proj({
      id: "army",
      type: "Army",
      completionPercent: 50,
      children: [proj({ id: "u1", completionPercent: 100 })],
    });
    expect(projectMatchesRoster(army, "DONE", undefined, TODAY)).toBe(true);
    expect(projectMatchesRoster(army, "IN PROGRESS", undefined, TODAY)).toBe(true);
    expect(projectMatchesRoster(army, "ON HOLD", undefined, TODAY)).toBe(false);
  });
});

describe("sortRoster", () => {
  const a = proj({ id: "a", title: "Zeta", completionPercent: 10, priority: "Low" });
  const b = proj({ id: "b", title: "Alpha", completionPercent: 90, priority: "High" });

  test("completion descending / ascending", () => {
    expect(sortRoster([a, b], "completion-desc").map((p) => p.id)).toEqual(["b", "a"]);
    expect(sortRoster([a, b], "completion-asc").map((p) => p.id)).toEqual(["a", "b"]);
  });

  test("priority descending (High first)", () => {
    expect(sortRoster([a, b], "priority-desc").map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("title A–Z", () => {
    expect(sortRoster([a, b], "title-asc").map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("time logged descending via minutesOf accessor", () => {
    const minutes: Record<string, number> = { a: 120, b: 30 };
    expect(sortRoster([a, b], "time-desc", (p) => minutes[p.id] ?? 0).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  test("does not mutate the input array", () => {
    const input = [a, b];
    sortRoster(input, "title-asc");
    expect(input.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
