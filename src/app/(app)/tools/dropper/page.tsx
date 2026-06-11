"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyedropperTool } from "@/components/tools/EyedropperTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useMockData } from "@/mock/MockProvider";
import { closestPaint } from "@/mock/derive";

// Host-provided extraction result (stubbed). Real extraction happens host-side after upload.
const MOCK_EXTRACTED = ["#7a4a2b", "#caa05a", "#3a5a78", "#1c2433", "#b5c4cc", "#5a6b3a"];

export default function EyedropperPage() {
  const data = useMockData();
  const router = useRouter();
  const [extracted, setExtracted] = useState<string[]>([]);

  return (
    <ToolShell title="COLOR DROPPER" blurb="Use uploaded images to find the perfect paints.">
      <EyedropperTool
        extractedColors={extracted}
        closestPaint={(hex) => closestPaint(hex, data.paints)}
        onImageDropped={() => setExtracted(MOCK_EXTRACTED)}
        onSavePalette={() => {}}
        onSendToRecipe={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
