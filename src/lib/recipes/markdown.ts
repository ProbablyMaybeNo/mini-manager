import { techniqueLabel } from "./techniqueLabel";
import type { TechniqueKey } from "@/db/schema";

export interface MarkdownSlot {
  technique: TechniqueKey;
  paintName?: string | null;
  paintBrand?: string | null;
  hex?: string | null;
  notesMd: string | null;
}

export interface MarkdownInput {
  recipe: {
    name: string;
    bodyType: string;
    notesMd: string | null;
  };
  /** Flat ordered slot list (2026-06-04 unify). */
  slots: ReadonlyArray<MarkdownSlot>;
  /** When set, appended as a "Made with The Mini Mainframe" footer link. */
  publicUrl?: string;
}

function normaliseHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const trimmed = hex.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function renderSlot(slot: MarkdownSlot, index: number): string {
  const label = techniqueLabel(slot.technique);
  const hex = normaliseHex(slot.hex);
  let body = "";
  if (slot.paintName) {
    const brand = slot.paintBrand ? `${slot.paintBrand} ` : "";
    body = `${brand}${slot.paintName}`;
    if (hex) body += ` \`${hex}\``;
  } else if (hex) {
    body = `Custom mix \`${hex}\``;
  } else {
    body = "_(no paint chosen)_";
  }
  let out = `${index + 1}. **${label}** — ${body}`;
  if (slot.notesMd && slot.notesMd.trim().length > 0) {
    out += `\n   *${slot.notesMd.trim()}*`;
  }
  return out;
}

/**
 * Render a recipe as Reddit-friendly Markdown. Format:
 *
 *     # Recipe name
 *
 *     *A Mini Mainframe recipe*
 *
 *     ## Slots
 *
 *     1. **Basecoat** — Citadel Caliban Green `#0F4A33`
 *     2. **Wash** — Army Painter Strong Tone `#3A2618`
 *     ...
 *
 *     ---
 *     [Made with The Mini Mainframe](<publicUrl>)
 *
 * Pure function — no I/O, no side effects. Snapshot-tested in P5.8.
 * Trailing newline omitted; the consumer can append one if needed.
 */
export function recipeToMarkdown(input: MarkdownInput): string {
  const parts: string[] = [];
  parts.push(`# ${input.recipe.name}`);
  parts.push("");
  parts.push("*A Mini Mainframe recipe*");
  parts.push("");

  parts.push("## Slots");
  parts.push("");
  if (input.slots.length === 0) {
    parts.push("_(no slots recorded)_");
  } else {
    input.slots.forEach((slot, idx) => {
      parts.push(renderSlot(slot, idx));
    });
  }
  parts.push("");

  if (input.recipe.notesMd && input.recipe.notesMd.trim().length > 0) {
    parts.push("## Notes");
    parts.push("");
    parts.push(input.recipe.notesMd.trim());
    parts.push("");
  }

  if (input.publicUrl) {
    parts.push("---");
    parts.push(`[Made with The Mini Mainframe](${input.publicUrl})`);
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}
