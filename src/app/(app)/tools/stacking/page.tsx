"use client";

import { useRouter } from "next/navigation";
import { LayeringTool } from "@/components/tools/LayeringTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useMockData } from "@/mock/MockProvider";
import { closestPaint } from "@/mock/derive";

export default function LayeringPage() {
  const data = useMockData();
  const router = useRouter();
  return (
    <ToolShell title="COLOR STACKING" blurb="Stack paints and determine the perfect layering.">
      <LayeringTool
        closestPaint={(hex) => closestPaint(hex, data.paints)}
        onSavePalette={() => {}}
        onSendToRecipe={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
