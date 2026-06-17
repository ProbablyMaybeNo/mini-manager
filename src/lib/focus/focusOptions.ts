import type { Project } from "@/lib/types";

export interface FocusOption {
  id: string;
  /** Indented label so nested sub-projects read as a tree in the dropdown. */
  label: string;
  type: string;
}

/**
 * Flatten the project tree into a depth-indented option list so the focus
 * picker can offer Armies *and* their nested Units / Models as focus targets
 * (MM-23). Two leading spaces per depth level keep the <option> text aligned
 * in the native dropdown. Pure + framework-free so it's unit-testable.
 */
export function flattenFocusOptions(
  projects: Project[],
  depth = 0,
  acc: FocusOption[] = [],
): FocusOption[] {
  for (const p of projects) {
    acc.push({
      id: p.id,
      label: `${"  ".repeat(depth)}${p.title}`,
      type: p.type,
    });
    if (p.children?.length) flattenFocusOptions(p.children, depth + 1, acc);
  }
  return acc;
}
