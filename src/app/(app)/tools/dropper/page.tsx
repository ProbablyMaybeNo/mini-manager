"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";
import { imageToPixels, validateImageBlob } from "@/lib/tools/eyedropper/sample";
import { extractDominantColors } from "@/lib/tools/eyedropper/kmeans";

export default function EyedropperPage() {
  const paints = useCatalog();
  const router = useRouter();
  const [extracted, setExtracted] = useState<string[]>([]);
  const { save, dialog } = usePaletteSaver("eyedropper");

  return (
    <ToolShell title="COLOR DROPPER" blurb="Use uploaded images to find the perfect paints.">
      <EyedropperTool
        extractedColors={extracted}
        closestPaint={(hex) => closestPaint(hex, paints)}
        onImageDropped={async (file) => {
          if (validateImageBlob(file)) return;
          const img = await imageToPixels(file);
          setExtracted(
            extractDominantColors(img.pixels, img.width, img.height, { k: 6 }),
          );
        }}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
