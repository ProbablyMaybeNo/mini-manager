import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryView, type LibraryViewProps } from "./LibraryView";
import { EMPTY_LIBRARY_FILTER } from "@/lib/types";
import { mockMatchResults, mockPaints } from "@/mock/fixtures";

function renderLibrary(overrides: Partial<LibraryViewProps> = {}) {
  const handlers = {
    onFilterChange: vi.fn(),
    onClearFilter: vi.fn(),
    onOpenPaint: vi.fn(),
    onClosePaint: vi.fn(),
    onToggleOwned: vi.fn(),
    onToggleWishlist: vi.fn(),
    onStepOwned: vi.fn(),
    onWishlist: vi.fn(),
    onCopyHex: vi.fn(),
    onAssignPaint: vi.fn(),
  };
  render(
    <LibraryView
      paints={mockPaints}
      totalCount={7144}
      filter={EMPTY_LIBRARY_FILTER}
      colorOptions={["Red", "Blue", "Green"]}
      brandOptions={["Citadel", "Vallejo", "Army Painter"]}
      selectedPaint={null}
      ownedCount={3}
      matchResults={mockMatchResults}
      similar={[]}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("LibraryView", () => {
  it("renders the swatch grid in the default grid view", () => {
    renderLibrary();

    expect(screen.getByRole("heading", { name: "LIBRARY" })).toBeInTheDocument();
    const wall = screen.getByRole("list", { name: "Paint swatches" });
    // One swatch listitem per paint in the fixture.
    expect(within(wall).getAllByRole("listitem")).toHaveLength(mockPaints.length);
  });

  it("opens the filter slide-out when the Filter button is clicked", async () => {
    renderLibrary();

    // No dialog before opening.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^filter/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("fires onOpenPaint when a swatch is selected", async () => {
    const { onOpenPaint } = renderLibrary();

    const wall = screen.getByRole("list", { name: "Paint swatches" });
    const swatches = within(wall).getAllByRole("listitem");
    await userEvent.click(swatches[0]);

    expect(onOpenPaint).toHaveBeenCalledOnce();
    expect(onOpenPaint).toHaveBeenCalledWith(mockPaints[0]);
  });
});
