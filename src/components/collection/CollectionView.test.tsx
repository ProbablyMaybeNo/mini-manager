import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionView } from "./CollectionView";
import {
  mockCollectionModels,
  mockCollectionPaints,
  mockProjects,
} from "@/mock/fixtures";

function renderCollection() {
  const onStatusChange = vi.fn();
  render(
    <CollectionView
      paints={mockCollectionPaints}
      models={mockCollectionModels}
      projects={mockProjects}
      onAddUrl={vi.fn()}
      onStatusChange={onStatusChange}
      onAssignProject={vi.fn()}
      onAttachRecipe={vi.fn()}
      onRemove={vi.fn()}
      onAddPaint={vi.fn()}
      onAddModel={vi.fn()}
    />,
  );
  return { onStatusChange };
}

describe("CollectionView", () => {
  it("renders the paint and model collection tables", () => {
    renderCollection();
    expect(screen.getByText("MY PAINT COLLECTION")).toBeInTheDocument();
    expect(screen.getByText("MY MODEL COLLECTION")).toBeInTheDocument();
    expect(screen.getByText("Primaris Captain")).toBeInTheDocument();
  });

  it("fires onStatusChange when a status dropdown changes", async () => {
    const { onStatusChange } = renderCollection();

    const firstPaint = mockCollectionPaints[0]!;
    // Both seeded paints share the name "Red Paint", so the accessible name is
    // not unique — take the first status dropdown, which belongs to c1.
    const select = screen.getAllByRole("combobox", {
      name: `Status for ${firstPaint.name}`,
    })[0]!;
    await userEvent.selectOptions(select, "PAINTING");

    expect(onStatusChange).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalledWith(firstPaint, "PAINTING");
  });
});
