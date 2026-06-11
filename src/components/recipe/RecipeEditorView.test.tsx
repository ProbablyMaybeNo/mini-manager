import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeEditorView } from "./RecipeEditorView";
import type { Recipe } from "@/lib/types";
import { mockPaints, mockProjects, mockRecipes } from "@/mock/fixtures";

/**
 * RecipeEditorView is controlled (recipe in, onChange out). Wrap it so the tree
 * re-renders with each onChange, mirroring how a route wrapper holds the state,
 * while still spying on every onChange call.
 */
function Harness({ initial, onChange }: { initial: Recipe; onChange: (r: Recipe) => void }) {
  const [recipe, setRecipe] = useState(initial);
  return (
    <RecipeEditorView
      recipe={recipe}
      projects={mockProjects}
      paints={mockPaints}
      onChange={(next) => {
        setRecipe(next);
        onChange(next);
      }}
      onShare={() => {}}
      onBack={() => {}}
      onSave={() => {}}
    />
  );
}

describe("RecipeEditorView", () => {
  it("adds a slot when '+ Add slot' is clicked", async () => {
    const onChange = vi.fn();
    // Start from a recipe with a known slot count.
    const base = { ...mockRecipes[1]!, slots: [...mockRecipes[1]!.slots] };
    render(<Harness initial={base} onChange={onChange} />);

    const before = base.slots.length;
    await userEvent.click(screen.getByRole("button", { name: /add slot/i }));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0]![0] as Recipe;
    expect(next.slots).toHaveLength(before + 1);
  });

  it("edits a slot layer and propagates it via onChange", async () => {
    const onChange = vi.fn();
    const base = { ...mockRecipes[0]!, slots: [...mockRecipes[0]!.slots] };
    render(<Harness initial={base} onChange={onChange} />);

    const layerInput = screen.getByRole("textbox", { name: "Layer for slot 1" });
    await userEvent.clear(layerInput);
    await userEvent.type(layerInput, "Basecoat");

    expect(onChange).toHaveBeenCalled();
    const latest = onChange.mock.calls.at(-1)![0] as Recipe;
    expect(latest.slots[0]!.layer).toBe("Basecoat");
  });
});
