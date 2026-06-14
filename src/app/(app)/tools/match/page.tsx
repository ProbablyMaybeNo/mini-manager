"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColourMatchTool } from "@/components/tools/ColourMatchTool";
import { ToolShell } from "@/components/tools/ToolShell";
import { rankMatches } from "@/lib/toolMatch";
import { useCatalog } from "../useCatalog";

export default function ColourMatchPage() {
  const paints = useCatalog();
  const router = useRouter();
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  return (
    <ToolShell title="COLOR MATCH" blurb="Match paints across companies and harmonies.">
      <ColourMatchTool
        rankMatches={(hex, brand) => rankMatches(hex, paints, brand)}
        brandOptions={brandOptions}
        onUse={() => {}}
        onAssign={() => router.push("/recipes")}
      />
    </ToolShell>
  );
}
