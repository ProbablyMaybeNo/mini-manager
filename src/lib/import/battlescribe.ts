import { XMLParser } from "fast-xml-parser";

/**
 * BattleScribe roster → normalised army/unit/model tree.
 *
 * This is the *structured* view of a BattleScribe roster: every unit keeps
 * its individual model breakdown rather than collapsing to a single count.
 * It powers the `importBattleScribeRoster` server action, which lands the
 * tree as an Army → Unit → Model project hierarchy.
 *
 * (The sibling `@/lib/imports/battleScribeParser` produces the flatter
 * `{ name, count }[]` shape consumed by the generic multi-format import
 * preview. Both walk the same XML; this one preserves the per-model detail.)
 *
 * Roster shape (simplified — real exports carry far more noise):
 *
 *   <roster name="My Army">
 *     <forces>
 *       <force catalogueName="...">
 *         <selections>
 *           <selection type="unit" name="Intercessor Squad">
 *             <selections>
 *               <selection type="model" name="Sergeant" number="1"/>
 *               <selection type="model" name="Intercessor" number="9"/>
 *             </selections>
 *           </selection>
 *         </selections>
 *       </force>
 *     </forces>
 *   </roster>
 *
 * Defensive notes — variations seen in the wild, all handled here:
 *   - `type` may be "unit" / "model" / "upgrade" / "unit:..." or absent.
 *   - Counts may live in a `number` attribute, a `<number>` child, or be
 *     omitted (defaults to 1).
 *   - Models may be nested one or more layers below the unit (inside an
 *     upgrade group), so model collection recurses.
 *   - A unit with no model children (vehicles, single characters) yields a
 *     single synthetic model named after the unit.
 *   - Unknown / malformed shapes never throw — they yield an empty army.
 */

export interface ImportedModel {
  name: string;
  count: number;
}

export interface ImportedUnitTree {
  name: string;
  models: ImportedModel[];
}

export interface ImportedArmy {
  armyName: string;
  units: ImportedUnitTree[];
}

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // `selection` and `force` are the repeating containers. Pin them as arrays
  // so a single-child roster still produces an array (fast-xml-parser would
  // otherwise hand back a bare object). Everything else is normalised via
  // `toArray` below.
  isArray: (name: string) => name === "selection" || name === "force",
  trimValues: true,
} as const;

/**
 * Parse a BattleScribe `.ros` roster XML string into the normalised army
 * tree. Never throws — malformed input yields `{ armyName, units: [] }`.
 */
export function parseBattleScribeRoster(xml: string): ImportedArmy {
  let doc: unknown;
  try {
    doc = new XMLParser(parserOptions).parse(xml);
  } catch {
    return { armyName: "Untitled army", units: [] };
  }

  const roster = asRecord(asRecord(doc)?.roster);
  if (!roster) {
    return { armyName: "Untitled army", units: [] };
  }

  const armyName = pickString(roster["@_name"]) ?? "Untitled BattleScribe army";

  const forces = toArray(asRecord(roster.forces)?.force);
  const units: ImportedUnitTree[] = [];

  for (const force of forces) {
    const force_ = asRecord(force);
    if (!force_) continue;
    for (const sel of collectSelections(force_)) {
      const unit = readUnit(sel);
      if (unit) units.push(unit);
    }
  }

  return { armyName, units };
}

/* -----------------------------------------------------------------
   internals
   ----------------------------------------------------------------- */

/**
 * A top-level force selection becomes a unit when it is type="unit" (or has
 * no type but does carry model children — some exports omit the unit type on
 * the outer selection). Non-unit top-level selections (stratagems, army
 * rules) are skipped.
 */
function readUnit(node: Record<string, unknown>): ImportedUnitTree | null {
  const type = selectionType(node);
  const name = pickString(node["@_name"]);
  if (!name) return null;

  const models = collectModels(node);

  // A bare "upgrade"/"model" at the top level isn't a unit on its own; only
  // promote it if it's explicitly a unit, or it has nested models (an
  // untyped wrapper around a real squad).
  if (type !== "unit" && models.length === 0) return null;

  // No model children — a vehicle or single-character entry. Synthesise one
  // model from the unit itself so the tree always has a leaf to paint.
  if (models.length === 0) {
    const count = selectionCount(node) ?? 1;
    return { name, models: [{ name, count }] };
  }

  return { name, models };
}

function collectSelections(
  node: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const inner = asRecord(node.selections)?.selection;
  return toArray(inner)
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => r !== undefined);
}

/**
 * Recursively gather every `type="model"` selection under a unit, summing
 * duplicates by name so a squad listed as two `<selection number=N>` rows
 * collapses to one model line. Non-model groups (upgrades, weapon profiles)
 * are descended into so a model nested inside an upgrade group is still found.
 */
function collectModels(unit: Record<string, unknown>): ImportedModel[] {
  const ordered: string[] = [];
  const counts = new Map<string, number>();

  const visit = (node: Record<string, unknown>) => {
    for (const child of collectSelections(node)) {
      const type = selectionType(child);
      if (type === "model") {
        const name = pickString(child["@_name"]);
        if (name) {
          const n = selectionCount(child) ?? 1;
          if (!counts.has(name)) ordered.push(name);
          counts.set(name, (counts.get(name) ?? 0) + n);
        }
      } else if (type !== "unit") {
        // Descend into upgrade / wrapper groups, but never cross into a
        // nested unit — that's a separate selection, not this unit's models.
        visit(child);
      }
    }
  };

  visit(unit);
  return ordered.map((name) => ({ name, count: counts.get(name) ?? 1 }));
}

/**
 * Normalise the selection `type`. BattleScribe is mostly "unit" / "model" /
 * "upgrade", but some catalogues namespace it ("unit:detachment") — match on
 * the leading token, lower-cased.
 */
function selectionType(node: Record<string, unknown>): string | undefined {
  const raw = pickString(node["@_type"]);
  if (!raw) return undefined;
  return raw.toLowerCase().split(/[:\s]/)[0];
}

/**
 * A selection's model count. Prefer the `number` attribute; fall back to a
 * `<number>` child element (text or `#text`). Returns null when absent so
 * callers can apply their own default.
 */
function selectionCount(node: Record<string, unknown>): number | null {
  const attr = parseIntLoose(node["@_number"]);
  if (attr !== null) return attr;

  const child = node.number;
  if (typeof child === "string" || typeof child === "number") {
    return parseIntLoose(child);
  }
  const childRecord = asRecord(child);
  if (childRecord) {
    return parseIntLoose(childRecord["#text"]);
  }
  return null;
}

function toArray(maybe: unknown): unknown[] {
  if (maybe === undefined || maybe === null) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function pickString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

function parseIntLoose(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}
