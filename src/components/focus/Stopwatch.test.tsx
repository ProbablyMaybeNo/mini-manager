import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Stopwatch } from "./Stopwatch";
import { mockSessionStats } from "@/mock/fixtures";

describe("FocusView Stopwatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts at zero and increments the timer after Start", () => {
    // Drive performance.now() deterministically alongside the fake interval clock.
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    render(<Stopwatch stats={mockSessionStats} onLogSession={vi.fn()} />);

    // Timer is shown and starts at zero.
    expect(screen.getByText("00:00:00")).toBeInTheDocument();

    // Synchronous fireEvent click — userEvent deadlocks under fake timers.
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    // Advance the wall clock 5s, then let the 250ms tick interval fire.
    act(() => {
      now = 5000;
      vi.advanceTimersByTime(250);
    });

    // The running button flips to Stop and the display has moved off zero.
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.getByText("00:00:05")).toBeInTheDocument();
    expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
  });
});
