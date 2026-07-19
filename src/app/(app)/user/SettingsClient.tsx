"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SettingsView, type TableDensity } from "@/components/user/SettingsView";
import { exportAllUserData } from "@/lib/actions/exportData";

export function SettingsClient() {
  const router = useRouter();
  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [, startTransition] = useTransition();

  return (
    <SettingsView
      density={density}
      onDensityChange={setDensity}
      onImport={() => router.push("/collection")}
      onExport={() => {
        startTransition(async () => {
          const res = await exportAllUserData();
          if (!res.ok) return;
          const blob = new Blob([JSON.stringify(res.data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `mini-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }}
      onSignOut={() => {
        // Hit the real signout route — it tears down the DB-backed session
        // cookie and redirects to /sign-in.
        window.location.href = "/auth/signout";
      }}
    />
  );
}
