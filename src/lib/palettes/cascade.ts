/**
 * Pure helpers for palette validation. Lives outside the "use server"
 * actions module so unit tests can import it without dragging in the
 * Next/DB stack — the same precedent as `lib/counters/cascade.ts` and
 * `lib/namedModels/cascade.ts`.
 */

const HEX6 = /^#[0-9A-F]{6}$/;

/**
 * Normalise a single hex input. Returns the upper-cased #RRGGBB form,
 * or null if the input doesn't parse. Accepts 3-digit shorthand.
 */
export function normaliseHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.replace(/^#/, "").toUpperCase()}`;
  }
  if (/^#?[0-9a-fA-F]{3}$/.test(trimmed)) {
    const body = trimmed.replace(/^#/, "");
    const c0 = body.charAt(0);
    const c1 = body.charAt(1);
    const c2 = body.charAt(2);
    return `#${c0}${c0}${c1}${c1}${c2}${c2}`.toUpperCase();
  }
  return null;
}

export interface PaletteValidation {
  ok: true;
  colorHexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}
export interface PaletteValidationError {
  ok: false;
  error: string;
}

/**
 * Validate the colour + paint-id arrays a palette action receives. Used
 * by `createPalette` to enforce:
 *   - colorHexes is non-empty
 *   - every entry is a well-formed #RRGGBB after normalisation
 *   - when paintIds is supplied, its length matches colorHexes; null-
 *     fills when omitted.
 */
export function validatePaletteColors(
  rawHexes: ReadonlyArray<unknown>,
  rawPaintIds: ReadonlyArray<unknown> | undefined | null,
): PaletteValidation | PaletteValidationError {
  if (!Array.isArray(rawHexes) || rawHexes.length === 0) {
    return { ok: false, error: "Palette needs at least one colour." };
  }
  if (rawHexes.length > 32) {
    return {
      ok: false,
      error: "Palette has too many colours (max 32).",
    };
  }
  const colorHexes: string[] = [];
  for (const raw of rawHexes) {
    const next = normaliseHex(raw);
    if (!next || !HEX6.test(next)) {
      return {
        ok: false,
        error: `Invalid hex value: ${typeof raw === "string" ? raw : "?"}`,
      };
    }
    colorHexes.push(next);
  }

  let paintIds: (string | null)[];
  if (rawPaintIds === undefined || rawPaintIds === null) {
    paintIds = colorHexes.map(() => null);
  } else {
    if (!Array.isArray(rawPaintIds)) {
      return { ok: false, error: "paintIds must be an array." };
    }
    if (rawPaintIds.length !== colorHexes.length) {
      return {
        ok: false,
        error: "paintIds length must match colorHexes length.",
      };
    }
    paintIds = rawPaintIds.map((v) =>
      typeof v === "string" && v.length > 0 ? v : null,
    );
  }

  return { ok: true, colorHexes, paintIds };
}
