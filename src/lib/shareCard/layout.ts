/**
 * Recipe-card phase 2 — pure layout math for the branded share card.
 *
 * Kept ratio-driven and framework-free so the composer's DOM just reads
 * numbers out of here instead of hard-coding breakpoints, and so 16:9 / 4:5
 * (deferred) are a one-line addition to RATIO_FACTOR + SHARE_CARD_RATIOS
 * later rather than a rewrite.
 */

export type ShareCardRatio = "1:1" | "9:16";

export const SHARE_CARD_RATIOS: ReadonlyArray<{ value: ShareCardRatio; label: string }> = [
  { value: "1:1", label: "1:1 SQUARE" },
  { value: "9:16", label: "9:16 STORY" },
];

/** height = width * factor */
const RATIO_FACTOR: Record<ShareCardRatio, number> = {
  "1:1": 1,
  "9:16": 16 / 9,
};

/** Card height for a given card width, at the chosen ratio. Same unit in and out. */
export function cardHeightFor(ratio: ShareCardRatio, widthPx: number): number {
  return Math.round(widthPx * RATIO_FACTOR[ratio]);
}

/**
 * A stored export ratio ("1:1", "9:16", …) as a CSS `aspect-ratio`, for
 * pre-sizing a gallery tile before its image loads.
 *
 * Deliberately parses the stored string rather than switching on the two
 * ratios that exist today: the gallery used to hard-code
 * square-unless-9:16, which would silently crop the 16:9 / 4:5 this module
 * is built to add. Anything unrecognised — including the null on rows
 * predating the ratio column — falls back to square, which is what those
 * cards were exported as.
 */
export function cardAspectRatio(ratio: string | null | undefined): string {
  return ratio && /^\d+:\d+$/.test(ratio) ? ratio.replace(":", " / ") : "1 / 1";
}

export interface SwatchGridInput {
  ratio: ShareCardRatio;
  /** Number of paint slots to render. */
  slotCount: number;
  /** Width, in px, of the area available for the swatch grid (card width minus the frame's inner padding). */
  areaWidthPx: number;
  gapPx?: number;
}

export interface SwatchGridLayout {
  columns: number;
  rows: number;
  swatchSizePx: number;
  /** Below this, a square can't legibly hold the paint name inside it — the
   *  caller renders the name as a caption underneath the square instead. */
  nameInsideSwatch: boolean;
}

/** Below this a swatch can't legibly hold its paint name as internal text. */
const MIN_NAME_INSIDE_PX = 96;
/** Never shrink a swatch below this — beyond this floor the grid should wrap
 *  to more rows rather than keep shrinking columns. */
const MIN_SWATCH_PX = 40;
const DEFAULT_GAP_PX = 10;

/**
 * Lay out the recipe's paint swatches as a grid that reflows with the card's
 * ratio and slot count: the square 1:1 card gets up to 4 columns, the taller
 * 9:16 story gets up to 3 (a same-size grid on the narrower story card would
 * otherwise shrink the squares past legibility).
 */
export function computeSwatchGrid({
  ratio,
  slotCount,
  areaWidthPx,
  gapPx = DEFAULT_GAP_PX,
}: SwatchGridInput): SwatchGridLayout {
  const count = Math.max(1, Math.floor(slotCount) || 1);
  const maxColumns = ratio === "9:16" ? 3 : 4;
  const columns = Math.max(1, Math.min(maxColumns, count));
  const rows = Math.ceil(count / columns);
  const swatchSizePx = Math.max(
    MIN_SWATCH_PX,
    Math.floor((areaWidthPx - gapPx * (columns - 1)) / columns),
  );
  return {
    columns,
    rows,
    swatchSizePx,
    nameInsideSwatch: swatchSizePx >= MIN_NAME_INSIDE_PX,
  };
}

/** `<recipe-name>-mini-mainframe.png` — falls back to a generic name for the
 *  imageless/no-recipe card (spec's blank-fallback path). */
export function shareCardFilename(recipeName: string | null | undefined): string {
  const slug = (recipeName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "mini-mainframe-card"}-mini-mainframe.png`;
}
