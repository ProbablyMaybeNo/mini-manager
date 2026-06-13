"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsView, type TableDensity } from "@/components/user/SettingsView";

export default function UserPage() {
  const router = useRouter();
  const [density, setDensity] = useState<TableDensity>("comfortable");
  return (
    <SettingsView
      plan={{ name: "Free" }}
      density={density}
      onDensityChange={setDensity}
      onUpgrade={() => router.push("/pricing")}
      onImport={() => {}}
      onExport={() => {}}
      onSignOut={() => router.push("/")}
    />
  );
}
