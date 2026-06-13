"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { useMockData } from "@/mock/MockProvider";
import { rankMatches } from "@/mock/derive";

export default function ColourMatchPage() {
  const data = useMockData();
  const router = useRouter();
  const brandOptions = useMemo(
    () => Array.from(new Set(data.paints.map((p) => p.brand))).sort(),
    [data.paints],
  );
  return (
    <ToolShell title="COLOR MATCH" blurb="Match paints across companies and harmonies.">
      <ColourMatchTool
        rankMatches={(hex, brand) => rankMatches(hex, data.paints, brand)}
        brandOptions={brandOptions}
        onUse={() => {}}
        onAssign={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
