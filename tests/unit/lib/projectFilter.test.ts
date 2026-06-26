/**
 * DOP-017 — /projects management-list filter + sort helpers. Pure tree logic,
 * no DB. Covers query/status/type/priority filtering (with ancestor-keeping
 * for the tree) and the four sort keys.
 */
import { describe, expect, test } from "vitest";
import {
  applyProjectFilters,
  DEFAULT_PROJECT_FILTERS,
  hasActiveFilters,
  type ProjectFilters,
} from "@/lib/projectFilter";
import type { Project } from "@/lib/types";

function mk(partial: Partial<Project> & { id: string; title: string }): Project {
  return {
    type: "Unit",
    recipeSwatches: [],
    status: "OWNED",
    priority: "Med",
    completionPercent: 0,
    ...partial,
  };
}

const filters = (over: Partial<ProjectFilters> = {}): ProjectFilters => ({
  ...DEFAULT_PROJECT_FILTERS,
  ...over,
});

const tree: Project[] = [
  mk({
    id: "army-1",
    title: "Maggotkin",
    type: "Army",
    status: "PAINTING",
    priority: "High",
    completionPercent: 40,
    updatedAt: 200,
    children: [
      mk({
        id: "unit-1",
        title: "Plague Marines",
        type: "Unit",
        status: "BASING",
        completionPercent: 80,
        children: [
          mk({ id: "model-1", title: "Lord of Contagion", type: "Model", status: "COMPLETE" }),
        ],
      }),
    ],
  }),
  mk({
    id: "warband-1",
    title: "Iron Golems",
    type: "Warband",
    status: "WISHLIST",
    priority: "Low",
    completionPercent: 0,
    updatedAt: 100,
  }),
];

describe("applyProjectFilters — query", () => {
  test("matches title case-insensitively", () => {
    const out = applyProjectFilters(tree, filters({ query: "maggot" }));
    expect(out.map((p) => p.id)).toEqual(["army-1"]);
  });

  test("keeps ancestors when a descendant matches", () => {
    const out = applyProjectFilters(tree, filters({ query: "lord of contagion" }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("army-1");
    expect(out[0].children?.[0].id).toBe("unit-1");
    expect(out[0].children?.[0].children?.[0].id).toBe("model-1");
  });

  test("empty query is a no-op", () => {
    const out = applyProjectFilters(tree, filters({ query: "   " }));
    expect(out).toHaveLength(2);
  });
});

describe("applyProjectFilters — facet filters", () => {
  test("type filter keeps matching descendants under their ancestors", () => {
    const out = applyProjectFilters(tree, filters({ type: "Model" }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("army-1");
    expect(out[0].children?.[0].children?.[0].id).toBe("model-1");
  });

  test("status filter matches the node directly", () => {
    const out = applyProjectFilters(tree, filters({ status: "WISHLIST" }));
    expect(out.map((p) => p.id)).toEqual(["warband-1"]);
  });

  test("priority filter", () => {
    const out = applyProjectFilters(tree, filters({ priority: "High" }));
    expect(out.map((p) => p.id)).toEqual(["army-1"]);
  });

  test("a self-matching node keeps its whole subtree", () => {
    const out = applyProjectFilters(tree, filters({ type: "Army" }));
    expect(out).toHaveLength(1);
    expect(out[0].children?.[0].id).toBe("unit-1");
  });
});

describe("applyProjectFilters — sort", () => {
  test("name sorts top-level rows A–Z", () => {
    const out = applyProjectFilters(tree, filters({ sort: "name" }));
    expect(out.map((p) => p.title)).toEqual(["Iron Golems", "Maggotkin"]);
  });

  test("completion sorts highest first", () => {
    const out = applyProjectFilters(tree, filters({ sort: "completion" }));
    expect(out.map((p) => p.id)).toEqual(["army-1", "warband-1"]);
  });

  test("priority sorts High → Low", () => {
    const out = applyProjectFilters(tree, filters({ sort: "priority" }));
    expect(out.map((p) => p.id)).toEqual(["army-1", "warband-1"]);
  });

  test("updated sorts most-recent first; missing timestamps sink", () => {
    const out = applyProjectFilters(tree, filters({ sort: "updated" }));
    expect(out.map((p) => p.id)).toEqual(["army-1", "warband-1"]);
  });
});

describe("hasActiveFilters", () => {
  test("false for defaults", () => {
    expect(hasActiveFilters(DEFAULT_PROJECT_FILTERS)).toBe(false);
  });
  test("sort alone does not count as an active filter", () => {
    expect(hasActiveFilters(filters({ sort: "completion" }))).toBe(false);
  });
  test("any facet or query counts", () => {
    expect(hasActiveFilters(filters({ query: "x" }))).toBe(true);
    expect(hasActiveFilters(filters({ status: "OWNED" }))).toBe(true);
    expect(hasActiveFilters(filters({ type: "Model" }))).toBe(true);
    expect(hasActiveFilters(filters({ priority: "Low" }))).toBe(true);
  });
});
