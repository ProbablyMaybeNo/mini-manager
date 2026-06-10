import type { Route } from "next";

/** Shared nav model for the app shell (FIGMA-REBUILD, REBUILD_SPEC §2).
 *  One source of truth for the desktop SidebarRail and the mobile sheet. */
export type NavItem = {
  href: Route;
  label: string;
};

/** Primary rail group — DASHBOARD · LIBRARY · RECIPE · TOOLS · COLLECTION. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/projects" as Route, label: "DASHBOARD" },
  { href: "/library" as Route, label: "LIBRARY" },
  { href: "/recipes" as Route, label: "RECIPE" },
  { href: "/tools" as Route, label: "TOOLS" },
  { href: "/collection" as Route, label: "COLLECTION" },
] as const;

/** Lower pinned group — SETTINGS · ACCOUNT. Both resolve to /user until a
 *  dedicated split exists (flagged for the undesigned-pages agent). */
export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/user" as Route, label: "SETTINGS" },
  { href: "/user" as Route, label: "ACCOUNT" },
] as const;

export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/projects") {
    // /projects IS the dashboard; the root path lands there too.
    return pathname === "/" || pathname.startsWith("/projects");
  }
  if (href === "/collection") {
    // Legacy routes redirect here; light the item during the hop too.
    return (
      pathname.startsWith("/collection") || pathname.startsWith("/wishlist")
    );
  }
  return pathname.startsWith(href);
}
