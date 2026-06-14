"use client";

import { useRouter } from "next/navigation";
import { LayeringTool } from "@/components/tools/LayeringTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function LayeringPage() {
  const paints = useCatalog();
  const router = useRouter();
  const { save, dialog } = usePaletteSaver("gradient");
  return (
    <ToolShell title="COLOR STACKING" blurb="Stack paints and determine the perfect layering.">
      <LayeringTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
