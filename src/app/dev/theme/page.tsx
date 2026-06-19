import { notFound } from "next/navigation";
import { ThemeStudio } from "./ThemeStudio";

/**
 * Dev-only Theme Studio — live design-token editor + kitchen-sink preview.
 * Edit colours / fonts / sizes by sight, watch the whole preview re-skin in
 * real time, then copy the @theme block into src/app/globals.css. 404s in prod.
 */
export default function ThemeStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ThemeStudio />;
}
