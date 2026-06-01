import type { ProjectType } from "@/db/schema";

export interface KitInference {
  modelCount: number;
  suggestedType: ProjectType;
}

/** Common GW (+ a few others) kit names → model count. Tiny by design. */
const KNOWN_KITS: ReadonlyArray<{ pattern: RegExp; count: number }> = [
  { pattern: /\bcombat patrol\b/i, count: 30 },
  { pattern: /\bstart collecting\b/i, count: 20 },
  { pattern: /\bbattleforce\b/i, count: 40 },
  { pattern: /\bintercessors?\b/i, count: 10 },
  { pattern: /\bnecron warriors?\b/i, count: 20 },
  { pattern: /\bork bo+ys?\b/i, count: 20 },
  { pattern: /\btactical squad\b/i, count: 10 },
  { pattern: /\bcustode?s? guard\b/i, count: 5 },
  { pattern: /\btermagants?\b/i, count: 24 },
  { pattern: /\bhormagaunts?\b/i, count: 24 },
  { pattern: /\bgenestealers?\b/i, count: 10 },
  { pattern: /\bskink starter\b/i, count: 12 },
  { pattern: /\bcommand squad\b/i, count: 5 },
  { pattern: /\bhonor guard\b/i, count: 4 },
  { pattern: /\bvanguard\b/i, count: 5 },
];

const COUNT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bx\s*(\d{1,3})\b/i, // "Intercessors x10"
  /\b(\d{1,3})\s*[-]?\s*pack\b/i, // "10-pack" / "10 pack"
  /^\s*(\d{1,3})\s+/, // "10 Intercessors"
  /\bset of\s*(\d{1,3})\b/i, // "Set of 10"
];

export function inferKitContents(title: string): KitInference {
  const trimmed = title.trim();

  for (const kit of KNOWN_KITS) {
    if (kit.pattern.test(trimmed)) {
      return {
        modelCount: kit.count,
        suggestedType: "Unit",
      };
    }
  }

  for (const re of COUNT_PATTERNS) {
    const m = trimmed.match(re);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 1000) {
        return { modelCount: n, suggestedType: "Unit" };
      }
    }
  }

  return { modelCount: 1, suggestedType: "Unit" };
}
