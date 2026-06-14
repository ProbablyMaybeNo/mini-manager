"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useToast } from "@/components/kit";
import { rankMatches } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function ColourMatchPage() {
  const paints = useCatalog();
  const router = useRouter();
  const { toast, node } = useToast();
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  return (
    <ToolShell title="COLOR MATCH" blurb="Match paints across companies and harmonies.">
      <ColourMatchTool
        rankMatches={(hex, brand) => rankMatches(hex, paints, brand)}
        brandOptions={brandOptions}
        onUse={(paint) => {
          void navigator.clipboard?.writeText(paint.hex);
          toast(`Copied ${paint.name} · ${paint.hex}`, "green");
        }}
        onAssign={() => router.push("/recipes")}
      />
      {node}
    </ToolShell>
  );
}
