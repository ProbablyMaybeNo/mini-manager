import type { ImportedTree, ImportedUnit, TextParseResult } from "./types";

/**
 * Convert a JSON army list into the shared {@link ImportedTree} shape so it
 * flows through the same persist + preview pipeline as text / PDF /
 * BattleScribe imports. Pure function — no I/O.
 *
 * Two input shapes are accepted, in this priority order:
 *
 *   1. **App export (v3+).** The object Mini Manager's own "Export data"
 *      produces: `{ __exportVersion, projects: [...] }` where `projects`
 *      is a flat list of rows. We pick the first `type: "Army"` row as the
 *      container and gather its `type: "Unit"` children by `parentId`. If
 *      no Army row exists we treat every `Unit` row as a standalone list.
 *
 *   2. **Simple list.** A hand-authored / third-party object shaped like
 *      `{ name, units: [{ name, models }] }`. `models` and `count` are
 *      interchangeable; `points`/`pointsValue` and `faction`/`totalPoints`
 *      aliases are all honoured. The internal `{ armyName, units:[{ name,
 *      count, points }] }` tree is a strict subset of this, so re-importing
 *      an exported single tree works too.
 *
 * Conservative on confidence: a clean structured parse is high-signal, so
 * a non-empty result reports 0.95 and never triggers the LLM fallback. A
 * structurally-valid-but-empty document reports 0 with a warning.
 */
export function parseJsonList(raw: string): TextParseResult {
  const warnings: string[] = [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: [
        `Invalid JSON: ${err instanceof Error ? err.message : "could not parse"}`,
      ],
    };
  }

  if (!isRecord(data)) {
    return {
      tree: { armyName: "Untitled army", units: [] },
      confidence: 0,
      warnings: ["JSON root must be an object describing an army list."],
    };
  }

  const tree = isAppExport(data)
    ? treeFromAppExport(data, warnings)
    : treeFromSimpleList(data, warnings);

  const confidence = tree.units.length > 0 ? 0.95 : 0;
  if (tree.units.length === 0 && warnings.length === 0) {
    warnings.push("No units found in the JSON list.");
  }

  return { tree, confidence, warnings };
}

/* -----------------------------------------------------------------
   App-export (v3) shape
   ----------------------------------------------------------------- */

function isAppExport(data: Record<string, unknown>): boolean {
  return "__exportVersion" in data || Array.isArray(data.projects);
}

function treeFromAppExport(
  data: Record<string, unknown>,
  warnings: string[],
): ImportedTree {
  const rows = Array.isArray(data.projects)
    ? data.projects.filter(isRecord)
    : [];

  const armyRow = rows.find((r) => r.type === "Army");
  const unitRows = armyRow
    ? rows.filter((r) => r.type === "Unit" && r.parentId === armyRow.id)
    : rows.filter((r) => r.type === "Unit");

  if (armyRow && unitRows.length === 0) {
    warnings.push(
      "Found an Army project but none of its Unit children — importing the Army on its own.",
    );
  }
  if (!armyRow && unitRows.length > 0) {
    warnings.push(
      "No Army container in the export — importing the Unit rows as a standalone list.",
    );
  }

  const units: ImportedUnit[] = unitRows.map((r) => toUnit(r, warnings));

  const armyName =
    coerceString(armyRow?.name) ?? coerceString(data.name) ?? "Untitled army";
  const totalPoints =
    coerceCount(armyRow?.pointsValue) ?? coerceCount(armyRow?.points);
  const faction = coerceString(armyRow?.faction);

  return buildTree(armyName, units, totalPoints, faction);
}

/* -----------------------------------------------------------------
   Simple `{ name, units: [...] }` shape
   ----------------------------------------------------------------- */

function treeFromSimpleList(
  data: Record<string, unknown>,
  warnings: string[],
): ImportedTree {
  const armyName =
    coerceString(data.armyName) ?? coerceString(data.name) ?? "Untitled army";
  const totalPoints =
    coerceCount(data.totalPoints) ?? coerceCount(data.points);
  const faction = coerceString(data.faction);

  const rawUnits = Array.isArray(data.units) ? data.units : [];
  if (!Array.isArray(data.units)) {
    warnings.push('Expected a "units" array on the JSON object.');
  }

  const units: ImportedUnit[] = rawUnits
    .filter(isRecord)
    .map((u) => toUnit(u, warnings))
    .filter((u) => u.name.length > 0);

  return buildTree(armyName, units, totalPoints, faction);
}

/* -----------------------------------------------------------------
   shared coercion
   ----------------------------------------------------------------- */

function toUnit(row: Record<string, unknown>, warnings: string[]): ImportedUnit {
  const name = coerceString(row.name) ?? "";
  if (name.length === 0) {
    warnings.push("Skipped a unit with no name.");
  }
  // `count` is the internal field; `models` is the friendlier alias used by
  // hand-authored lists. Default to 1 — a named character with no count.
  const count = coerceCount(row.count) ?? coerceCount(row.models) ?? 1;
  const points = coerceCount(row.points) ?? coerceCount(row.pointsValue);
  const notes = coerceString(row.notes) ?? coerceString(row.notesMd);

  return {
    name,
    count: Math.min(Math.max(count, 1), 9999),
    ...(points !== undefined ? { points } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function buildTree(
  armyName: string,
  units: ImportedUnit[],
  totalPoints: number | undefined,
  faction: string | undefined,
): ImportedTree {
  return {
    armyName,
    units,
    ...(totalPoints !== undefined ? { totalPoints } : {}),
    ...(faction !== undefined ? { faction } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const n = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
