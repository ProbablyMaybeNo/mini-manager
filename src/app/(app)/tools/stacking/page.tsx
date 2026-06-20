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
    <ToolShell
      title="COLOR STACKING"
      blurb="Build a layering ladder from base to highlight and preview how glazes and washes stack on a substrate. Dial in each layer, then save the result as a palette or turn the stack into a recipe."
    >
      <LayeringTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
