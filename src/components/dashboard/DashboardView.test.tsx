import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "./DashboardView";
import { deriveDashboardSummary } from "@/mock/derive";
import { mockActivity, mockEvents, mockProjects, mockSessionStats } from "@/mock/fixtures";

function renderDashboard(overrides: Partial<Parameters<typeof DashboardView>[0]> = {}) {
  const onOpenProject = vi.fn();
  render(
    <DashboardView
      summary={deriveDashboardSummary(mockProjects, mockSessionStats)}
      projects={mockProjects}
      events={mockEvents}
      activity={mockActivity}
      onOpenProject={onOpenProject}
      {...overrides}
    />,
  );
  return { onOpenProject };
}

describe("DashboardView", () => {
  it("renders the stat row and the projects table", () => {
    renderDashboard();

    // Page title.
    expect(screen.getByRole("heading", { name: "DASHBOARD" })).toBeInTheDocument();

    // Stats row exposes the derived active-project count: 7 projects minus
    // COMPLETE (Eldar Aspect) and WISHLIST (Ruined Hab-Block) = 5 active.
    const summary = deriveDashboardSummary(mockProjects, mockSessionStats);
    expect(summary.activeProjects).toBe(5);

    // Projects table renders one row-button per project.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Space Marines")).toBeInTheDocument();
    expect(within(table).getByText("Ork Boyz")).toBeInTheDocument();
  });

  it("fires onOpenProject when a project row is clicked", async () => {
    const { onOpenProject } = renderDashboard();

    await userEvent.click(screen.getByRole("button", { name: "Open Space Marines" }));

    expect(onOpenProject).toHaveBeenCalledOnce();
    expect(onOpenProject).toHaveBeenCalledWith(mockProjects[0]);
  });

  it("shows the empty state when there are no projects", () => {
    renderDashboard({
      summary: deriveDashboardSummary([], mockSessionStats),
      projects: [],
    });

    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });
});
