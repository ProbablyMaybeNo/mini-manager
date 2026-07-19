import {
  Archive,
  Cog,
  Crosshair,
  Database,
  FlaskConical,
  Hammer,
  Images,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/types";

export interface NavItem {
  key: NavKey;
  label: string;
  path: string;
  /** Lucide icon for the V2 sidebar rail (icon+label rows per Figma 4:4). */
  icon?: LucideIcon;
  /** First-run tour anchor — emitted as `data-tour` on the rendered link so
   *  the walkthrough can spotlight this nav item. */
  tour?: string;
}

/** Primary rail items (top). */
export const MAIN_NAV: NavItem[] = [
  { key: "dashboard", label: "PROJECTS", path: "/dashboard", icon: LayoutGrid, tour: "nav-dashboard" },
  { key: "focus", label: "FOCUS", path: "/focus", icon: Crosshair, tour: "nav-focus" },
  { key: "library", label: "LIBRARY", path: "/library", icon: Database, tour: "nav-library" },
  { key: "recipe", label: "RECIPES", path: "/recipes", icon: FlaskConical, tour: "nav-recipe" },
  { key: "tools", label: "TOOLS", path: "/tools", icon: Hammer, tour: "nav-tools" },
  { key: "collection", label: "COLLECTION", path: "/collection", icon: Archive, tour: "nav-collection" },
  { key: "gallery", label: "GALLERY", path: "/gallery", icon: Images, tour: "nav-gallery" },
];

/** Pinned-bottom rail items. Account was folded into the Settings page (one
 *  entry, one page with a SETTINGS + ACCOUNT section), so it's no longer a
 *  separate nav item. */
export const FOOTER_NAV: NavItem[] = [
  { key: "settings", label: "SETTINGS", path: "/user", icon: Cog },
];

export const ALL_NAV = [...MAIN_NAV, ...FOOTER_NAV];

/**
 * Phone bottom-nav split (MUX-001). The four thumb-zone primaries always show
 * as labelled tabs; everything else folds into a "More" sheet. Keys reference
 * MAIN_NAV / FOOTER_NAV so the labels + tour anchors stay single-sourced.
 */
const byKey = (key: NavKey): NavItem => {
  const item = ALL_NAV.find((n) => n.key === key);
  if (!item) throw new Error(`nav item not found: ${key}`);
  return item;
};

/** The four labelled tabs pinned in the phone bottom bar. */
export const BOTTOM_NAV_PRIMARY: NavItem[] = [
  byKey("dashboard"),
  byKey("library"),
  byKey("collection"),
  byKey("tools"),
];

/** Items that live behind the bottom bar's "More" entry on phones. */
export const BOTTOM_NAV_MORE: NavItem[] = [
  byKey("focus"),
  byKey("recipe"),
  byKey("gallery"),
  byKey("settings"),
];

/**
 * Resolve which nav item is active for a pathname: the item whose path is the longest
 * prefix of the current path. Deterministic ties broken by declaration order.
 */
export function activeNavKey(pathname: string): NavKey | null {
  let best: NavItem | null = null;
  for (const item of ALL_NAV) {
    if (pathname === item.path || pathname.startsWith(item.path + "/")) {
      if (!best || item.path.length > best.path.length) best = item;
    }
  }
  return best?.key ?? null;
}
