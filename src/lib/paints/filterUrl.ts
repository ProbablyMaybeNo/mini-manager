/**
 * Bidirectional mapping between the PaintFilter shape and URL search
 * params. The library page binds filter state to the URL so it survives
 * navigation and is shareable.
 *
 * Param contract:
 *   ?brand=Citadel,Vallejo  ?line=Layer  ?type=Wash,Contrast
 *   ?hue=Red,Blue           ?owned=1     ?hex=5a9dd8
 *   ?q=ultramarines         ?sort=brand  ?paint=<id>
 */
import type { PaintFilter, PaintType } from "./types";
import { paintTypes } from "./types";
import { sortModes, type SortMode } from "./sort";

function csvIn(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function filterFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): PaintFilter {
  const brands = csvIn(params.get("brand"));
  const lines = csvIn(params.get("line"));
  const rawTypes = csvIn(params.get("type"));
  const types = rawTypes.filter((t): t is PaintType =>
    (paintTypes as readonly string[]).includes(t),
  );
  const hueBands = csvIn(params.get("hue"));
  const ownedOnly = params.get("owned") === "1";
  const hexQuery = params.get("hex") ?? "";
  const textQuery = params.get("q") ?? "";
  return { brands, lines, types, hueBands, ownedOnly, hexQuery, textQuery };
}

export function sortFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): SortMode {
  const raw = params.get("sort");
  if (raw && (sortModes as readonly string[]).includes(raw)) return raw as SortMode;
  return "brand";
}

export function selectedPaintFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): string | null {
  return params.get("paint");
}

/**
 * Apply a filter patch to a URLSearchParams instance, mutating it in place.
 * Empty / default values clear the corresponding param so the URL stays
 * tidy.
 */
export function writeFilterToParams(
  params: URLSearchParams,
  patch: Partial<PaintFilter>,
): void {
  if (patch.brands !== undefined) setCsv(params, "brand", patch.brands);
  if (patch.lines !== undefined) setCsv(params, "line", patch.lines);
  if (patch.types !== undefined) setCsv(params, "type", patch.types);
  if (patch.hueBands !== undefined) setCsv(params, "hue", patch.hueBands);
  if (patch.ownedOnly !== undefined) {
    if (patch.ownedOnly) params.set("owned", "1");
    else params.delete("owned");
  }
  if (patch.hexQuery !== undefined) {
    if (patch.hexQuery) params.set("hex", patch.hexQuery);
    else params.delete("hex");
  }
  if (patch.textQuery !== undefined) {
    if (patch.textQuery) params.set("q", patch.textQuery);
    else params.delete("q");
  }
}

function setCsv(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length === 0) params.delete(key);
  else params.set(key, values.join(","));
}

/** Minimal subset of Next's ReadonlyURLSearchParams we lean on. */
type ReadonlyURLSearchParams = Pick<URLSearchParams, "get">;
