"use client";

import { useRouter } from "next/navigation";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function EyedropperPage() {
  const paints = useCatalog();
  const router = useRouter();
  const { save, dialog } = usePaletteSaver("eyedropper");

  return (
    <ToolShell
      title="COLOR DROPPER"
      blurb="Upload a reference photo and eyedrop any pixel to read its exact colour. Each sample is matched to the closest real paints across brands, ready to save as a palette or build into a recipe."
    >
      <EyedropperTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
