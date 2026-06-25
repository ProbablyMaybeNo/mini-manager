import type { NavKey } from "@/lib/types";

export interface NavItem {
  key: NavKey;
  label: string;
  path: string;
  /** First-run tour anchor — emitted as `data-tour` on the rendered link so
   *  the walkthrough can spotlight this nav item. */
  tour?: string;
}

/** Primary rail items (top). */
export const MAIN_NAV: NavItem[] = [
  { key: "dashboard", label: "DASHBOARD", path: "/dashboard", tour: "nav-dashboard" },
  { key: "focus", label: "FOCUS", path: "/focus", tour: "nav-focus" },
  { key: "library", label: "LIBRARY", path: "/library", tour: "nav-library" },
  { key: "recipe", label: "RECIPES", path: "/recipes", tour: "nav-recipe" },
  { key: "tools", label: "TOOLS", path: "/tools", tour: "nav-tools" },
  { key: "collection", label: "COLLECTION", path: "/collection", tour: "nav-collection" },
];

/** Pinned-bottom rail items. */
export const FOOTER_NAV: NavItem[] = [
  { key: "settings", label: "SETTINGS", path: "/user" },
  { key: "account", label: "ACCOUNT", path: "/user/account" },
];

export const ALL_NAV = [...MAIN_NAV, ...FOOTER_NAV];

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
