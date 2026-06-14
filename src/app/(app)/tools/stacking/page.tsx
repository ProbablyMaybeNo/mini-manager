"use client";

import { useRouter } from "next/navigation";
import { LayeringTool } from "@/components/tools/LayeringTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { closestPaint } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function LayeringPage() {
  const paints = useCatalog();
  const router = useRouter();
  return (
    <ToolShell title="COLOR STACKING" blurb="Stack paints and determine the perfect layering.">
      <LayeringTool
        closestPaint={(hex) => closestPaint(hex, paints)}
        onSavePalette={() => {}}
        onSendToRecipe={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
