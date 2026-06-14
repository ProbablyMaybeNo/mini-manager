"use client";

import { useRouter } from "next/navigation";
import { ColourWheelTool } from "@/components/tools/ColourWheelTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function ColourWheelPage() {
  const paints = useCatalog();
  const router = useRouter();
  return (
    <ToolShell title="COLOR WHEEL" blurb="Explore, experiment, and find the perfect colour combos.">
      <ColourWheelTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={() => {}}
        onSendToRecipe={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
