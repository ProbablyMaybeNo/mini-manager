"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/kit";
import { validateScanImageFile, type ScanImageMediaType } from "@/lib/paints/scanLimits";
import type { BulkOwnershipStatus } from "@/lib/paints/ownership";
import type { PaintScanMatch } from "@/lib/paints/matchScan";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import { ScanPaintsDialog } from "./ScanPaintsDialog";

export type ScanPhotoOutcome =
  | { ok: true; items: PaintScanMatch[] }
  | { ok: false; error: string };

export interface ConfirmedScanPaint {
  paintId: string;
  status: BulkOwnershipStatus;
}

export type ConfirmScanOutcome = { ok: true } | { ok: false; error: string };

/** Read a File as base64 (no `data:...;base64,` prefix). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read photo"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read photo"));
    reader.readAsDataURL(file);
  });
}

/**
 * The "Scan paints" entry point — a photo picker (camera on phones) -> vision
 * scan -> confirm dialog -> bulk-add. Shared verbatim by the Collection page
 * and the Tools-hub Paint Scanner (/tools/scan); the Tools route is already
 * gated a layer up (ToolShell), but the Collection page has no other gate,
 * so the subscriber check lives HERE — the one place both callers pass
 * through — rather than being duplicated at each call site. Presentational
 * orchestration otherwise — `onScan` and `onConfirm` are supplied by the
 * route, which owns the actual server-action calls and local-state
 * absorption (matching PasteUrlBar's `onAddUrl` pattern).
 */
export function ScanPaintsFlow({
  onScan,
  onConfirm,
}: {
  onScan: (imageBase64: string, mediaType: ScanImageMediaType) => Promise<ScanPhotoOutcome>;
  onConfirm: (confirmed: ConfirmedScanPaint[]) => Promise<ConfirmScanOutcome>;
}) {
  const isSubscriber = useSubscriber();
  const [gateOpen, setGateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [items, setItems] = useState<PaintScanMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setScanError(null);
    const check = validateScanImageFile(file);
    if (!check.ok) {
      setScanError(check.error);
      return;
    }
    setScanning(true);
    try {
      const imageBase64 = await readFileAsBase64(file);
      const res = await onScan(imageBase64, file.type as ScanImageMediaType);
      if (!res.ok) {
        setScanError(res.error);
        return;
      }
      setConfirmError(null);
      setItems(res.items);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFile(file);
  }

  async function handleConfirm(confirmed: ConfirmedScanPaint[]) {
    setConfirmError(null);
    setBusy(true);
    try {
      const res = await onConfirm(confirmed);
      if (!res.ok) {
        setConfirmError(res.error);
        return;
      }
      setItems(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
        aria-label="Scan paints from a photo"
      />
      <div>
        <Button
          variant="secondary"
          onClick={() => {
            if (!isSubscriber) {
              setGateOpen(true);
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={scanning}
        >
          {/* 🔒 for non-subscribers (paywall audit MUX-P05). This and
              "⬆ Upload Army" were the only two gates in the app that looked
              identical to the working buttons beside them — every other gate
              announces itself, and that inconsistency is exactly what makes a
              paywall read as bait-and-switch. The button stays enabled and
              still opens the gate; it just stops pretending. */}
          {scanning ? "Scanning…" : isSubscriber ? "Scan paints" : "🔒 Scan paints"}
        </Button>
      </div>
      {scanError && (
        <p className="rounded-[6px] border border-border px-3 py-2 font-body text-body leading-snug text-red">
          ▸ {scanError}
        </p>
      )}
      <ScanPaintsDialog
        open={items !== null}
        items={items ?? []}
        busy={busy}
        error={confirmError}
        onConfirm={handleConfirm}
        onClose={() => {
          setItems(null);
          setConfirmError(null);
        }}
      />
      <SubscribeGateDialog open={gateOpen} onClose={() => setGateOpen(false)} />
    </div>
  );
}
