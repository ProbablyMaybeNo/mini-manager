import { describe, expect, test } from "vitest";
import { flattenFocusOptions } from "@/lib/focus/focusOptions";
import type { Project } from "@/lib/types";

function project(partial: Partial<Project> & { id: string; title: string }): Project {
  return {
    type: "Unit",
    recipeSwatches: [],
    status: "BUILDING",
    priority: "Med",
    completionPercent: 0,
    ...partial,
  };
}

describe("flattenFocusOptions — MM-23 focus picker", () => {
  test("flattens a project tree depth-first with indented labels", () => {
    const tree: Project[] = [
      project({
        id: "army",
        title: "Death Guard",
        type: "Army",
        children: [
          project({
            id: "unit",
            title: "Plague Marines",
            type: "Unit",
            children: [project({ id: "model", title: "Champion", type: "Model" })],
          }),
        ],
      }),
      project({ id: "warband", title: "Kill Team", type: "Warband" }),
    ];

    const opts = flattenFocusOptions(tree);

    expect(opts.map((o) => o.id)).toEqual([
      "army",
      "unit",
      "model",
      "warband",
    ]);
    expect(opts[0].label).toBe("Death Guard");
    expect(opts[1].label).toBe("  Plague Marines");
    expect(opts[2].label).toBe("    Champion");
    expect(opts[3].label).toBe("Kill Team");
  });

  test("returns an empty list for no projects", () => {
    expect(flattenFocusOptions([])).toEqual([]);
  });

  test("carries the project type through for each option", () => {
    const opts = flattenFocusOptions([
      project({ id: "a", title: "A", type: "Army" }),
    ]);
    expect(opts[0].type).toBe("Army");
  });
});
