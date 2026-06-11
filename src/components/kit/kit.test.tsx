import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { SwatchStrip } from "./Swatch";
import { StatusText } from "./tags";

describe("kit primitives", () => {
  it("ProgressBar clamps and exposes ARIA value", () => {
    render(<ProgressBar percent={140} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("Button forwards clicks via callback", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("SwatchStrip renders an attach affordance when empty", async () => {
    const onAttach = vi.fn();
    render(<SwatchStrip swatches={[]} onAttach={onAttach} />);
    await userEvent.click(screen.getByRole("button", { name: /attach/i }));
    expect(onAttach).toHaveBeenCalledOnce();
  });

  it("StatusText renders the status label", () => {
    render(<StatusText status="PAINTING" />);
    expect(screen.getByText("PAINTING")).toBeInTheDocument();
  });
});
