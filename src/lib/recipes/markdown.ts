import { techniqueLabel } from "@/components/recipes/TechniqueLabel";
import type { TechniqueKey } from "@/db/schema";

export interface MarkdownStep {
  technique: TechniqueKey;
  paintName?: string | null;
  paintBrand?: string | null;
  hex?: string | null;
  notesMd: string | null;
}

export interface MarkdownZone {
  name: string;
  steps: ReadonlyArray<MarkdownStep>;
}

export interface MarkdownInput {
  recipe: {
    name: string;
    bodyType: string;
    notesMd: string | null;
  };
  zones: ReadonlyArray<MarkdownZone>;
  /** When set, appended as a "Made with Mini Manager" footer link. */
  publicUrl?: string;
}

function normaliseHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const trimmed = hex.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function renderStep(step: MarkdownStep, index: number): string {
  const label = techniqueLabel(step.technique);
  const hex = normaliseHex(step.hex);
  let body = "";
  if (step.paintName) {
    const brand = step.paintBrand ? `${step.paintBrand} ` : "";
    body = `${brand}${step.paintName}`;
    if (hex) body += ` \`${hex}\``;
  } else if (hex) {
    body = `Custom mix \`${hex}\``;
  } else {
    body = "_(no paint chosen)_";
  }
  let out = `${index + 1}. **${label}** — ${body}`;
  if (step.notesMd && step.notesMd.trim().length > 0) {
    out += `\n   *${step.notesMd.trim()}*`;
  }
  return out;
}

/**
 * Render a recipe as Reddit-friendly Markdown. Format:
 *
 *     # Recipe name
 *
 *     *A Mini Manager recipe*
 *
 *     ## Zone 1
 *
 *     1. **Basecoat** — Citadel Caliban Green `#0F4A33`
 *     2. **Wash** — Army Painter Strong Tone `#3A2618`
 *     ...
 *
 *     ## Zone 2
 *     ...
 *
 *     ---
 *     [Made with Mini Manager](<publicUrl>)
 *
 * Pure function — no I/O, no side effects. Snapshot-tested in P5.8.
 * Trailing newline omitted; the consumer can append one if needed.
 */
export function recipeToMarkdown(input: MarkdownInput): string {
  const parts: string[] = [];
  parts.push(`# ${input.recipe.name}`);
  parts.push("");
  parts.push("*A Mini Manager recipe*");
  parts.push("");

  for (const zone of input.zones) {
    parts.push(`## ${zone.name}`);
    parts.push("");
    if (zone.steps.length === 0) {
      parts.push("_(no steps recorded)_");
    } else {
      zone.steps.forEach((step, idx) => {
        parts.push(renderStep(step, idx));
      });
    }
    parts.push("");
  }

  if (input.recipe.notesMd && input.recipe.notesMd.trim().length > 0) {
    parts.push("## Notes");
    parts.push("");
    parts.push(input.recipe.notesMd.trim());
    parts.push("");
  }

  if (input.publicUrl) {
    parts.push("---");
    parts.push(`[Made with Mini Manager](${input.publicUrl})`);
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}
