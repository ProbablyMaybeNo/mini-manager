/**
 * Pure helpers for the text army-list parser. No I/O, no side effects —
 * heavy unit-test surface. Public helpers are exported individually so
 * the parser tests can pin each behaviour without composing the full
 * pipeline.
 *
 * Design goal: prefer false negatives over hallucinated units. If a
 * regex doesn't match cleanly, skip the line + emit a warning. The P7.5
 * LLM-fallback exists precisely to handle the long tail this layer
 * cannot.
 */

export interface ParsedUnitLine {
  name: string;
  count: number;
  points?: number;
}

/**
 * Known factions — small static map for v1. Per-game expansion comes
 * from real usage data. Match order matters: longer keys first so
 * "Adeptus Astartes" beats "Astartes".
 */
const FACTION_KEYWORDS: ReadonlyArray<string> = [
  "Adeptus Astartes",
  "Space Marines",
  "Blood Angels",
  "Dark Angels",
  "Space Wolves",
  "Black Templars",
  "Imperial Fists",
  "Iron Hands",
  "Salamanders",
  "Raven Guard",
  "Ultramarines",
  "White Scars",
  "Grey Knights",
  "Deathwatch",
  "Adepta Sororitas",
  "Sisters of Battle",
  "Adeptus Custodes",
  "Adeptus Mechanicus",
  "Astra Militarum",
  "Imperial Guard",
  "Imperial Knights",
  "Chaos Space Marines",
  "Chaos Daemons",
  "Death Guard",
  "Thousand Sons",
  "World Eaters",
  "Emperor's Children",
  "Necrons",
  "Tyranids",
  "Genestealer Cults",
  "Orks",
  "Aeldari",
  "Eldar",
  "Drukhari",
  "Dark Eldar",
  "Harlequins",
  "Ynnari",
  "T'au Empire",
  "Tau",
  "Leagues of Votann",
  "Stormcast Eternals",
  "Sylvaneth",
  "Kharadron Overlords",
  "Fyreslayers",
  "Cities of Sigmar",
  "Daughters of Khaine",
  "Idoneth Deepkin",
  "Lumineth Realm-lords",
  "Seraphon",
  "Beasts of Chaos",
  "Blades of Khorne",
  "Disciples of Tzeentch",
  "Hedonites of Slaanesh",
  "Maggotkin of Nurgle",
  "Slaves to Darkness",
  "Skaven",
  "Flesh-eater Courts",
  "Nighthaunt",
  "Ossiarch Bonereapers",
  "Soulblight Gravelords",
  "Gloomspite Gitz",
  "Ironjawz",
  "Kruleboyz",
  "Sons of Behemat",
  "Ogor Mawtribes",
  "Trench Crusade",
  "Iron Sultanate",
  "Heretic Legions",
  "Court of the Seven-Headed Serpent",
];

const HEADING_PREFIXES = ["##", "#", "**"];

/**
 * Returns the first non-empty trimmed line that looks like a list title.
 * Heading markers (`#`, `##`, `**bold**`) are stripped from the result.
 * Falls back to the first non-empty line if no heading-like line exists.
 * Returns null only for completely empty input.
 */
export function extractArmyName(lines: ReadonlyArray<string>): string | null {
  const candidates = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (candidates.length === 0) return null;

  for (const line of candidates) {
    if (line.startsWith("##")) return stripHeading(line);
    if (line.startsWith("#")) return stripHeading(line);
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      return line.slice(2, -2).trim();
    }
    if (isAllCapsHeading(line)) return line;
  }
  return candidates[0]!;
}

function stripHeading(line: string): string {
  return line.replace(/^#+\s*/, "").replace(/\*+/g, "").trim();
}

function isAllCapsHeading(line: string): boolean {
  if (line.length < 4 || line.length > 80) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return letters === letters.toUpperCase();
}

/**
 * Detects the army's total point cost. Strong signals first:
 *   "Points Limit: 2000"  → 2000
 *   "1990pts"   (in a heading or anywhere)
 *   "[1850]"    (BattleScribe-style bracket on a heading line)
 *   "Total: 2000"  (only used if no Limit found)
 *
 * "Limit" wins over "Total" because tournament exports include both
 * (Limit = 2000, Total = sum of units < 2000) and the painter cares
 * about the army-size target, not the partial sum.
 *
 * Returns null if no pattern matches.
 */
export function extractTotalPoints(raw: string): number | null {
  // 1. "Points Limit: 2000" / "Battle Size: 2000"
  let m = /(?:points\s*limit|battle\s*size)\s*[:=]?\s*(\d{3,5})/i.exec(raw);
  if (m) return clampPoints(m[1]!);

  // 2. Heading-line points marker: a standalone "1990pts" line OR
  //    "[1850]" on its own line.
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    const standalone = /^(\d{3,5})\s*(?:pts?|points?)\s*$/i.exec(trimmed);
    if (standalone) return clampPoints(standalone[1]!);
    const bracket = /^\[(\d{3,5})(?:\s*pts?)?\]\s*$/i.exec(trimmed);
    if (bracket) return clampPoints(bracket[1]!);
  }

  // 3. Total: 2000 / "2000pts" anywhere in the text (weakest signal,
  //    last resort).
  m = /total[^\d]*?(\d{3,5})\s*(?:pts?|points?)?/i.exec(raw);
  if (m) return clampPoints(m[1]!);
  m = /(\d{3,5})\s*(?:pts?|points?)\s*(?:total|army|list)/i.exec(raw);
  if (m) return clampPoints(m[1]!);

  return null;
}

function clampPoints(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (n >= 100 && n <= 50_000) return n;
  return null;
}

/**
 * Best-guess faction from the input. Case-insensitive substring match
 * against FACTION_KEYWORDS. Returns the canonical-cased keyword on hit.
 */
export function extractFaction(raw: string): string | null {
  const lower = raw.toLowerCase();
  for (const keyword of FACTION_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) return keyword;
  }
  return null;
}

/**
 * Attempt to parse a single line into a unit entry. Returns null when
 * the line doesn't match any known pattern — the caller emits a warning.
 *
 * Supported formats (conservative regex set, ~6 patterns):
 *   10x Intercessors
 *   Intercessors x10
 *   10 Intercessors
 *   Tactical Squad (10) - 135pts
 *   ## Necron Warriors (20 models, 220pts)
 *   * Sergeant Vraks (1) — 25pts
 *   - Captain [85]
 */
export function parseUnitLine(rawLine: string): ParsedUnitLine | null {
  const line = stripBullet(rawLine).trim();
  if (line.length === 0) return null;
  if (looksLikeMetadata(line)) return null;

  // Strip a leading heading marker for "## Necron Warriors (20 models, 220pts)".
  let cleaned = line.replace(/^#+\s*/, "").replace(/^\*+\s*/, "").trim();

  // Pull off a trailing "— 25pts" / "- 200pts" / "(25pts)" / "[145]" so
  // sub-formats can match without that detritus and we still capture the
  // points value. Apply once up-front so Format B etc. don't have to.
  const trailing = extractTrailingPoints(cleaned);
  cleaned = trailing.remaining;
  const trailingPoints = trailing.points;

  // Format A: "10x Intercessors", "10 x Intercessors"
  let m = /^(\d{1,3})\s*x\s+(.+?)$/i.exec(cleaned);
  if (m) {
    const count = Number.parseInt(m[1]!, 10);
    const name = m[2]!.trim();
    if (count >= 1 && count <= 999 && name.length > 0) {
      return makeUnit(name, count, trailingPoints);
    }
  }

  // Format A2: leading number "10 Intercessors" (no x)
  m = /^(\d{1,3})\s+([A-Za-z][^\d].*)$/.exec(cleaned);
  if (m) {
    const count = Number.parseInt(m[1]!, 10);
    const name = m[2]!.trim();
    if (count >= 1 && count <= 999 && name.length > 1) {
      return makeUnit(name, count, trailingPoints);
    }
  }

  // Format B: "Intercessors x10" / "Intercessors X 10"
  m = /^(.+?)\s+x\s*(\d{1,3})\s*$/i.exec(cleaned);
  if (m) {
    const count = Number.parseInt(m[2]!, 10);
    const name = m[1]!.trim();
    if (count >= 1 && count <= 999 && name.length > 0) {
      return makeUnit(name, count, trailingPoints);
    }
  }

  // Format C: "Tactical Squad (10) - 135pts" / "Necron Warriors (20 models, 220pts)"
  m = /^(.+?)\s*\((\d{1,3})(?:\s*models?)?(?:[,\s]+(\d{2,5})\s*pts?)?\)\s*$/i.exec(cleaned);
  if (m) {
    const count = Number.parseInt(m[2]!, 10);
    const name = m[1]!.trim();
    const innerPoints = m[3] ? Number.parseInt(m[3], 10) : null;
    const points = trailingPoints ?? innerPoints;
    if (count >= 1 && count <= 999 && name.length > 0) {
      return makeUnit(name, count, points);
    }
  }

  // Format D: implicit count=1, name had trailing points already pulled.
  // We arrive here when none of the count-bearing patterns matched but
  // a points marker was present — treat as a single character / unit
  // entry. (e.g. "Captain in Terminator Armour - 105pts".)
  if (trailingPoints !== null && cleaned.length > 1 && looksLikeUnitName(cleaned)) {
    return { name: cleaned, count: 1, points: trailingPoints };
  }

  return null;
}

interface TrailingPointsResult {
  remaining: string;
  points: number | null;
}

/**
 * Strip a trailing points marker off a line. Recognises:
 *   "... - 135pts"        →  points=135
 *   "... — 25pts"
 *   "... (200pts)"
 *   "... [145]"  / "[145pts]"
 * Returns the line with the marker removed and the points value, or
 * the original line + null if no marker matches.
 */
function extractTrailingPoints(line: string): TrailingPointsResult {
  let m = /^(.*?)\s*[\-—]\s*(\d{2,5})\s*pts?\s*$/i.exec(line);
  if (m) return { remaining: m[1]!.trim(), points: Number.parseInt(m[2]!, 10) };

  m = /^(.*?)\s*\((\d{2,5})\s*pts?\)\s*$/i.exec(line);
  if (m) return { remaining: m[1]!.trim(), points: Number.parseInt(m[2]!, 10) };

  m = /^(.*?)\s*\[(\d{2,5})(?:\s*pts?)?\]\s*$/i.exec(line);
  if (m) return { remaining: m[1]!.trim(), points: Number.parseInt(m[2]!, 10) };

  return { remaining: line, points: null };
}

function makeUnit(
  name: string,
  count: number,
  points: number | null,
): ParsedUnitLine {
  return points !== null ? { name, count, points } : { name, count };
}

function stripBullet(line: string): string {
  return line.replace(/^[\s>]*[\*\-+•·]\s*/, "");
}

/**
 * Filters out lines that are not unit candidates: configuration headers,
 * metadata, separators, comment lines. Conservative — when in doubt
 * return false (try to parse).
 */
function looksLikeMetadata(line: string): boolean {
  const lower = line.toLowerCase();
  if (/^[=\-_]{3,}$/.test(line)) return true;
  if (/^(detachment|battle\s*size|points\s*limit|game\s*type|faction|sub-?faction|chapter|legion|gametype|warlord\s*trait|secondaries?|enhancements?)\s*[:=]/i.test(line)) return true;
  if (/^(total|grand\s*total|points)\s*[:=]?\s*\d/i.test(line)) return true;
  if (lower.startsWith("//") || lower.startsWith("--")) return true;
  return false;
}

function looksLikeUnitName(name: string): boolean {
  // At least one alphabetic char and not pure punctuation. Reject lines
  // that are obviously points totals or section dividers.
  if (!/[A-Za-z]/.test(name)) return false;
  if (/^\d+\s*pts?$/i.test(name)) return false;
  return true;
}
