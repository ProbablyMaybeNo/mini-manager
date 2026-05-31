import { describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

// next/image is a server-leaning component shim in unit tests — replace
// it with a plain <img> stand-in so we can introspect props.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => ({
    type: "img",
    props,
  }),
}));

const { Logo } = await import("@/components/ui/Logo");

function unwrap(element: ReactElement): {
  type: unknown;
  props: Record<string, unknown>;
} {
  return element as unknown as {
    type: unknown;
    props: Record<string, unknown>;
  };
}

describe("Logo primitive", () => {
  test("renders an image with the canonical brand alt text", () => {
    const tree = unwrap(Logo({}));
    // The mocked next/image returns { type: "img", props: ... }
    expect((tree.props as { alt: string }).alt).toBe("Mini Manager");
  });

  test("points at /brand/logo.png", () => {
    const tree = unwrap(Logo({}));
    expect((tree.props as { src: string }).src).toBe("/brand/logo.png");
  });

  test("applies the mix-blend-mode screen utility class", () => {
    const tree = unwrap(Logo({}));
    const cls = (tree.props as { className: string }).className;
    expect(cls).toMatch(/logo-screen/);
  });

  test("default sizing yields responsive ~110/140px width", () => {
    const tree = unwrap(Logo({}));
    const cls = (tree.props as { className: string }).className;
    expect(cls).toMatch(/w-\[110px\]/);
    expect(cls).toMatch(/md:w-\[140px\]/);
  });

  test("decorative variant suppresses the alt text + sets aria-hidden", () => {
    const tree = unwrap(Logo({ decorative: true }));
    expect((tree.props as { alt: string }).alt).toBe("");
    expect((tree.props as { "aria-hidden": boolean })["aria-hidden"]).toBe(
      true,
    );
  });

  test("explicit width overrides the responsive default", () => {
    const tree = unwrap(Logo({ width: 200 }));
    expect((tree.props as { width: number }).width).toBe(200);
  });
});
