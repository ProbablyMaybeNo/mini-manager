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
    <ToolShell title="COLOR DROPPER" blurb="Use uploaded images to find the perfect paints.">
      <EyedropperTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
