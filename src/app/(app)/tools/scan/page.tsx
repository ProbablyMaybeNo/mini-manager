"use client";

import { ToolShell } from "@/components/tools/ToolShell";
import {
  ScanPaintsFlow,
  type ConfirmedScanPaint,
  type ConfirmScanOutcome,
  type ScanPhotoOutcome,
} from "@/components/collection/ScanPaintsFlow";
import { Panel, useToast } from "@/components/kit";
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
      requiresPro
      title="PAINT SCANNER"
      blurb="Snap a photo of your paint pots and we'll read the labels, match them to the 7,000-paint library, and add them to your collection. Confirm the matches before anything is saved. Up to 20 scans a day."
    >
      {/* Audit B7 — this page is a paragraph and a button, and it sat at the
          top of a full-height shell: 541px empty below it at 1440×900 and
          462px at 375×812, ~60% of the screen either way. A panel that claims
          the height gives the tool a surface instead of stranding one button in
          the void, matching the Dropper's IMAGE panel next door. The old inner
          p-6 also doubled ToolShell's own padding. */}
      <Panel label="SCAN" cornerTicks className="flex flex-1 flex-col p-6">
        {/* Centring lives on this inner box, not the Panel: the Panel's label
            is one of its children, and centring the Panel itself pushed "SCAN"
            into the middle of the card away from every other panel's
            top-left label. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-md font-body text-body text-fg-dim">
            ▸ Point the camera at a shelf or a handful of pots — labels facing
            you, decent light. We match what we can read; you confirm before
            anything is added.
          </p>
          <ScanPaintsFlow onScan={scanPhoto} onConfirm={confirmScan} />
        </div>
      </Panel>
      {node}
    </ToolShell>
  );
}
