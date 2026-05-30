/**
 * Shared shape produced by every parser branch (text / PDF / BattleScribe /
 * LLM-fallback) and consumed by the import UI + `applyImport`. The browser
 * never sees the raw input; only this structured tree.
 */

export interface ImportedUnit {
  name: string;
  count: number;
  points?: number;
  /** Free-form annotations the parser surfaces — e.g. "Captain in Terminator
   *  Armour", "Sergeant Veteran". Painter can edit before apply. */
  notes?: string;
}

export interface ImportedTree {
  armyName: string;
  totalPoints?: number;
  /** Best-guess from the input — "Adeptus Astartes", "Orks", "Stormcast
   *  Eternals", etc. */
  faction?: string;
  units: ImportedUnit[];
}

/**
 * Every parser returns this. `confidence` drives the P7.5 LLM-fallback
 * decision (threshold = 0.6). `warnings` carries human-readable notes
 * about ambiguous lines that surface in the preview UI.
 */
export interface TextParseResult {
  tree: ImportedTree;
  confidence: number;
  warnings: string[];
}
