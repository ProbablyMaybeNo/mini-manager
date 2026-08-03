"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SettingsView, type TableDensity } from "@/components/user/SettingsView";
import { useToast } from "@/components/kit";
import { guarded } from "@/lib/actionGuard";
import { exportAllUserData } from "@/lib/actions/exportData";

export function SettingsClient() {
  const router = useRouter();
  const { toast, node } = useToast();
  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [, startTransition] = useTransition();

  return (
    <>
    <SettingsView
      density={density}
      onDensityChange={setDensity}
      onImport={() => router.push("/collection")}
      onExport={() => {
        startTransition(async () => {
          // R2-14 — an export is a big read, so it is the request most likely
          // to time out here; unguarded, that rejection replaced Settings with
          // the fault screen. The handled failure was silent too, which made a
          // failed export indistinguishable from a browser that blocked the
          // download — so both now say so.
          const res = await guarded(
            exportAllUserData,
            "Couldn’t build the export — check your connection, then try again.",
          );
          if (!res.ok) {
            toast(res.error, "red");
            return;
          }
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
    {node}
    </>
  );
}
