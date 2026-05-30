import "server-only";

import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import type { ImportedTree, ImportedUnit, TextParseResult } from "./types";

/**
 * Walk a BattleScribe `.ros` document and emit our shared TextParseResult
 * shape. BattleScribe rosters are the highest-quality input source —
 * confidence is 0.95-1.0 unless the XML is malformed.
 *
 * Roster shape (simplified):
 *   <roster name="My Army" gameSystemName="...">
 *     <costs><cost name="pts" value="..."/></costs>
 *     <forces><force catalogueName="...">
 *       <selections>
 *         <selection type="unit" name="...">
 *           <costs><cost name="pts" value="..."/></costs>
 *           <selections>
 *             <selection type="model" name="..." number="N"/>
 *             ...
 *           </selections>
 *         </selection>
 *       </selections>
 *     </force></forces>
 *   </roster>
 *
 * Count rule: a unit's count = sum of nested `selection[type="model"]`
 * numbers. If no model children exist (single character entries),
 * fall back to the unit's own `number` attribute (default 1).
 */

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // BattleScribe namespaces selections under both the roster and per-force.
  // The default array-detection heuristic is too generous; pin specific tags
  // that we know are always arrays. Everything else stays as object-or-array
  // and is normalised below.
  isArray: (name: string) => name === "selection" || name === "force",
  trimValues: true,
} as const;

export async function parseBattleScribeRos(text: string): Promise<TextParseResult> {
  const warnings: string[] = [];
  let doc: unknown;
  try {
    const parser = new XMLParser(parserOptions);
    doc = parser.parse(text);
  } catch (err) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: [
        `BattleScribe XML could not be parsed: ${err instanceof Error ? err.message : "unknown error"}`,
      ],
    };
  }

  const roster = (doc as Record<string, unknown>).roster as
    | Record<string, unknown>
    | undefined;
  if (!roster) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: ["No <roster> element in BattleScribe document"],
    };
  }

  const armyName =
    pickString(roster["@_name"]) ?? "Untitled BattleScribe army";

  const forces = toArray<Record<string, unknown>>(
    (roster.forces as Record<string, unknown> | undefined)?.force,
  );

  const units: ImportedUnit[] = [];
  let totalPoints = 0;
  let hasAnyPoints = false;

  // Faction = catalogueName of the first force. BattleScribe rosters with
  // detachments split across multiple forces still share a faction.
  const faction = pickString(forces[0]?.["@_catalogueName"]);

  for (const force of forces) {
    const selections = collectSelections(force);
    for (const sel of selections) {
      const unit = readUnitSelection(sel, warnings);
      if (unit) {
        units.push(unit);
        if (unit.points !== undefined) {
          totalPoints += unit.points;
          hasAnyPoints = true;
        }
      }
    }
  }

  // Roster-level points override the summed unit points if present.
  const rosterPts = readCostPts(roster.costs);
  if (rosterPts !== null) {
    totalPoints = rosterPts;
    hasAnyPoints = true;
  }

  const tree: ImportedTree = {
    armyName,
    units,
    ...(hasAnyPoints ? { totalPoints } : {}),
    ...(faction ? { faction: stripCataloguePrefix(faction) } : {}),
  };

  // BattleScribe XML is structured — high confidence unless we got
  // zero units (which suggests an unfamiliar schema variant).
  const confidence = units.length === 0 ? 0.4 : 0.97;
  return { tree, confidence, warnings };
}

export async function parseBattleScribeRosz(
  buffer: ArrayBuffer,
): Promise<TextParseResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch (err) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: [
        `.rosz archive could not be opened: ${err instanceof Error ? err.message : "unknown error"}`,
      ],
    };
  }

  const rosFile = Object.keys(entries).find((name) =>
    name.toLowerCase().endsWith(".ros"),
  );
  if (!rosFile) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: ["No .ros file found inside the .rosz archive"],
    };
  }

  const xmlBytes = entries[rosFile]!;
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  return parseBattleScribeRos(xml);
}

/* -----------------------------------------------------------------
   internals
   ----------------------------------------------------------------- */

function readUnitSelection(
  sel: Record<string, unknown>,
  warnings: string[],
): ImportedUnit | null {
  const type = pickString(sel["@_type"]);
  if (type !== "unit") return null;

  const name = pickString(sel["@_name"]);
  if (!name) {
    warnings.push("Skipped a <selection> with no name attribute");
    return null;
  }

  // Sum nested model counts. BattleScribe sometimes nests model
  // selections deeply (e.g. an upgrade group containing the model entry),
  // so we recurse but only sum entries that are type=model.
  const modelCount = sumModelCounts(sel);
  const fallbackCount = parseIntegerAttr(sel["@_number"]) ?? 1;
  const count = modelCount > 0 ? modelCount : fallbackCount;

  const points = readCostPts(sel.costs);

  return {
    name,
    count,
    ...(points !== null ? { points } : {}),
  };
}

function collectSelections(force: Record<string, unknown>): Array<Record<string, unknown>> {
  const inner = (force.selections as Record<string, unknown> | undefined)
    ?.selection;
  return toArray<Record<string, unknown>>(inner);
}

function sumModelCounts(node: Record<string, unknown>): number {
  let total = 0;
  const inner = (node.selections as Record<string, unknown> | undefined)
    ?.selection;
  const arr = toArray<Record<string, unknown>>(inner);
  for (const child of arr) {
    const type = pickString(child["@_type"]);
    if (type === "model") {
      const n = parseIntegerAttr(child["@_number"]) ?? 1;
      total += n;
    } else {
      // Recurse into non-model groups (upgrades, weapon profiles) in case
      // a model entry is nested another layer down. We deliberately do
      // NOT sum nested `unit` types — that's a separate selection.
      if (type !== "unit") total += sumModelCounts(child);
    }
  }
  return total;
}

function readCostPts(costsNode: unknown): number | null {
  if (!costsNode || typeof costsNode !== "object") return null;
  const costInner = (costsNode as Record<string, unknown>).cost;
  const arr = toArray<Record<string, unknown>>(costInner);
  for (const c of arr) {
    const name = pickString(c["@_name"]);
    if (name && name.toLowerCase() === "pts") {
      const value = parseFloatAttr(c["@_value"]);
      if (value !== null) return Math.round(value);
    }
  }
  return null;
}

function toArray<T>(maybe: unknown): T[] {
  if (maybe === undefined || maybe === null) return [];
  return Array.isArray(maybe) ? (maybe as T[]) : [maybe as T];
}

function pickString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

function parseIntegerAttr(v: unknown): number | null {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseFloatAttr(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * BattleScribe catalogue names usually carry a prefix like
 * "Adeptus Astartes - Ultramarines" — drop the prefix for the
 * faction field so it lines up with our text-parser dictionary.
 */
function stripCataloguePrefix(name: string): string {
  const idx = name.indexOf(" - ");
  if (idx > 0) return name.slice(0, idx).trim();
  return name;
}
