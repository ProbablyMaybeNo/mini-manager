"use client";

import { useRouter } from "next/navigation";
import { ColourWheelTool } from "@/components/tools/ColourWheelTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useMockData } from "@/mock/MockProvider";
import { closestPaint } from "@/mock/derive";

export default function ColourWheelPage() {
  const data = useMockData();
  const router = useRouter();
  return (
    <ToolShell title="COLOR WHEEL" blurb="Explore, experiment, and find the perfect colour combos.">
      <ColourWheelTool
        closestPaint={(hex) => closestPaint(hex, data.paints)}
        onSavePalette={() => {}}
        onSendToRecipe={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
