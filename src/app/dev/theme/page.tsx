import { ThemeStudio } from "./ThemeStudio";

/**
 * Theme Studio — live design-token editor + kitchen-sink preview. Edit colours
 * / fonts / sizes by sight, watch the whole preview re-skin in real time, then
 * copy the @theme block into src/app/globals.css.
 *
 * TEMPORARILY reachable in production (Ross, 2026-07-09) so fonts can be picked
 * on the live site — still behind the proxy's auth gate (logged-in only). Restore
 * the `if (process.env.NODE_ENV === "production") notFound();` guard once the
 * typeface is locked.
 */
export default function ThemeStudioPage() {
  return <ThemeStudio />;
}
