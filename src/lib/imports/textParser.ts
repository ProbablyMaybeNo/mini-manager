import type { ImportedTree, ImportedUnit, TextParseResult } from "./types";
import {
  extractArmyName,
  extractFaction,
  extractTotalPoints,
  parseUnitLine,
} from "./textHeuristics";

/**
 * Convert raw text (paste / forum / Notes app) into a structured
 * ImportedTree. Conservative — emits a warning rather than a bad row
 * when a line is ambiguous. Confidence score drives the P7.5
 * LLM-fallback (threshold = 0.6).
 *
 * The confidence weighting:
 *   - 0.25 for any unit parsed at all (something happened)
 *   - 0.30 by ratio of parseable lines / total non-blank lines
 *   - 0.20 if a total-points figure was detected
 *   - 0.15 if a faction was detected
 *   - 0.10 if the army name came from a heading marker (not a fallback)
 *
 * Pure function. No I/O.
 */
export function parseTextList(raw: string): TextParseResult {
  const warnings: string[] = [];
  if (!raw || raw.trim().length === 0) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: ["Empty input"],
    };
  }

  const lines = raw.split(/\r?\n/);
  const armyNameRaw = extractArmyName(lines) ?? "Untitled army";
  const totalPoints = extractTotalPoints(raw) ?? undefined;
  const faction = extractFaction(raw) ?? undefined;

  // Whether the army name came from a heading-style line (counts toward
  // confidence) or fell back to "first line".
  const armyNameFromHeading = looksLikeHeading(
    findFirstNonEmpty(lines) ?? "",
  );

  const units: ImportedUnit[] = [];
  let unparsedLines = 0;
  let totalNonBlank = 0;

  // Skip the army-name line itself (if present) so it doesn't get
  // re-counted as an unparsed unit.
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (i === firstNonEmptyIdx && trimmed === armyNameRaw) continue;

    totalNonBlank += 1;

    const parsed = parseUnitLine(trimmed);
    if (parsed) {
      units.push({
        name: parsed.name,
        count: parsed.count,
        ...(parsed.points !== undefined ? { points: parsed.points } : {}),
      });
    } else if (!isIgnorableLine(trimmed)) {
      unparsedLines += 1;
      if (warnings.length < 8) {
        warnings.push(
          `Line ${i + 1}: "${truncate(trimmed, 60)}" — couldn't parse, skipped`,
        );
      }
    } else {
      // Ignored line still counts in the denominator? No — purely
      // metadata lines shouldn't drag the ratio down. Pull them back
      // out of the count.
      totalNonBlank -= 1;
    }
  }

  // Confidence calculation.
  let confidence = 0;
  if (units.length > 0) confidence += 0.25;
  if (totalNonBlank > 0) {
    const parseRatio = units.length / (units.length + unparsedLines || 1);
    confidence += 0.3 * parseRatio;
  }
  if (totalPoints !== undefined) confidence += 0.2;
  if (faction !== undefined) confidence += 0.15;
  if (armyNameFromHeading) confidence += 0.1;

  // Clamp to [0, 1] and round to 3 d.p.
  confidence = Math.max(0, Math.min(1, confidence));
  confidence = Math.round(confidence * 1000) / 1000;

  const tree: ImportedTree = {
    armyName: armyNameRaw,
    units,
    ...(totalPoints !== undefined ? { totalPoints } : {}),
    ...(faction !== undefined ? { faction } : {}),
  };

  return { tree, confidence, warnings };
}

function findFirstNonEmpty(lines: ReadonlyArray<string>): string | null {
  for (const l of lines) {
    const t = l.trim();
    if (t.length > 0) return t;
  }
  return null;
}

function looksLikeHeading(line: string): boolean {
  if (line.startsWith("#")) return true;
  if (line.startsWith("**") && line.endsWith("**") && line.length > 4) return true;
  if (line.length >= 4 && line.length <= 80) {
    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 4 && letters === letters.toUpperCase()) return true;
  }
  return false;
}

function isIgnorableLine(line: string): boolean {
  // Section breaks, configuration metadata, common BattleScribe / WTC
  // export artefacts that we deliberately skip.
  if (/^[=\-_]{3,}$/.test(line)) return true;
  if (/^(detachment|battle\s*size|points\s*limit|game\s*type|faction|sub-?faction|chapter|legion|warlord\s*trait|secondaries?|enhancements?|relic|stratagem)\s*[:=]/i.test(line)) return true;
  if (/^(total|grand\s*total|points)\s*[:=]?\s*\d/i.test(line)) return true;
  if (/^army\s+(name|list|roster)\s*[:=]/i.test(line)) return true;
  if (/^(player|tournament|round|table|opponent|date)\s*[:=]/i.test(line)) return true;
  return false;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
