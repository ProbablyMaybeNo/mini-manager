"use client";

import { ToolShell } from "@/components/tools/ToolShell";
import {
  ScanPaintsFlow,
  type ConfirmedScanPaint,
  type ConfirmScanOutcome,
  type ScanPhotoOutcome,
} from "@/components/collection/ScanPaintsFlow";
import { useToast } from "@/components/kit";
import type { ScanImageMediaType } from "@/lib/paints/scanLimits";
import type { BulkOwnershipStatus } from "@/lib/paints/ownership";
import { scanPaintsFromPhoto } from "@/lib/actions/paintScan";
import { bulkAddPaintsToCollection } from "@/lib/actions/paintOwnership";

export default function PaintScannerPage() {
  const { toast, node } = useToast();

  async function scanPhoto(
    imageBase64: string,
    mediaType: ScanImageMediaType,
  ): Promise<ScanPhotoOutcome> {
    const res = await scanPaintsFromPhoto({ imageBase64, mediaType });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, items: res.data.items };
  }

  // Split the confirmed matches by Owned/Wishlist and persist each group
  // through the existing bulk-add path (same write the Library grid + the
  // Collection page's scanner use). No local list to absorb into here.
  async function confirmScan(confirmed: ConfirmedScanPaint[]): Promise<ConfirmScanOutcome> {
    const groups: { status: BulkOwnershipStatus; paintIds: string[] }[] = [
      { status: "OWNED", paintIds: confirmed.filter((c) => c.status === "OWNED").map((c) => c.paintId) },
      { status: "WISHLIST", paintIds: confirmed.filter((c) => c.status === "WISHLIST").map((c) => c.paintId) },
    ];
    let total = 0;
    for (const group of groups) {
      if (group.paintIds.length === 0) continue;
      const res = await bulkAddPaintsToCollection({ paintIds: group.paintIds, status: group.status });
      if (!res.ok) return { ok: false, error: res.error };
      total += res.data.count;
    }
    toast(`Added ${total} paint${total === 1 ? "" : "s"} to Collection`, "green");
    return { ok: true };
  }

  return (
    <ToolShell
      title="PAINT SCANNER"
      blurb="Snap a photo of your paint pots and we'll read the labels, match them to the 7,000-paint library, and add them to your collection. Confirm the matches before anything is saved. Up to 20 scans a day."
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <p className="max-w-md font-body text-body text-fg-dim">
          ▸ Point the camera at a shelf or a handful of pots — labels facing you,
          decent light. We match what we can read; you confirm before anything is
          added.
        </p>
        <ScanPaintsFlow onScan={scanPhoto} onConfirm={confirmScan} />
      </div>
      {node}
    </ToolShell>
  );
}
