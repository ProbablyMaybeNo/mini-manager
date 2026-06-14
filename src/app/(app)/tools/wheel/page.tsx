"use client";

import { useRouter } from "next/navigation";
import { ColourWheelTool } from "@/components/tools/ColourWheelTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { usePaletteSaver } from "@/components/tools/usePaletteSaver";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function ColourWheelPage() {
  const paints = useCatalog();
  const router = useRouter();
  const { save, dialog } = usePaletteSaver("wheel");
  return (
    <ToolShell title="COLOR WHEEL" blurb="Explore, experiment, and find the perfect colour combos.">
      <ColourWheelTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={save}
        onSendToRecipe={() => router.push("/recipes")}
      />
      {dialog}
    </ToolShell>
  );
}
