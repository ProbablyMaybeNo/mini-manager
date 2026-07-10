import { notFound } from "next/navigation";
import { ThemeStudio } from "./ThemeStudio";

/**
 * Theme Studio — live design-token editor + kitchen-sink preview. Edit colours
 * / fonts / sizes by sight, watch the whole preview re-skin in real time, then
 * copy the @theme block into src/app/globals.css.
 *
 * Dev-only: the prod 404 guard is restored (Ross, 2026-07-10) now that the title
 * typeface is locked to Nouveau IBM. It was temporarily exposed on prod so fonts
 * could be picked on the live site; that need is done.
 */
export default function ThemeStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ThemeStudio />;
}
