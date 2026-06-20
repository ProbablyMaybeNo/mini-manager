import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught about this project's custom `@utility` classes so it
 * doesn't misclassify them as conflicting with a real utility and silently
 * strip it. Without this, `cn("text-cyan", "text-glow-cyan")` collapsed to just
 * the glow (a text-shadow), leaving the element with no colour → white text —
 * which is what broke the dashboard stat colours and the orange priority chip.
 */
const twMerge = extendTailwindMerge<"mm-text-glow" | "mm-box-glow">({
  extend: {
    classGroups: {
      // text-shadow utilities — must NOT conflict with text-color.
      "mm-text-glow": [
        "text-glow-cyan",
        "text-glow-green",
        "text-glow-yellow",
        "text-glow-purple",
        "text-glow-red",
        "text-display-shadow",
      ],
      // box-shadow glow/depth utilities — their own group.
      "mm-box-glow": [
        "glow-cyan",
        "glow-green",
        "glow-yellow",
        "glow-purple",
        "glow-red",
        "panel-depth",
        "panel-depth-glow",
      ],
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts last-wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
