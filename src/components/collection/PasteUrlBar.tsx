"use client";

import { useState } from "react";
import { Button, Input, SegmentedToggle } from "@/components/kit";
import type { CollectionKind } from "@/lib/types";

/** Paste a store URL + choose Paint/Model → emits the URL; the host fetches/auto-fills. */
export function PasteUrlBar({ onAddUrl }: { onAddUrl: (url: string, kind: CollectionKind) => void }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<CollectionKind>("paint");

  function submit() {
    const u = url.trim();
    if (!u) return;
    onAddUrl(u, kind);
    setUrl("");
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <SegmentedToggle
        aria-label="Item type"
        options={[
          { value: "paint", label: "Paint" },
          { value: "model", label: "Model" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Input
        name="paste-url"
        placeholder="Paste a store URL to add paints and models"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        containerClassName="min-w-[260px] flex-1"
      />
      <Button onClick={submit}>Enter</Button>
    </div>
  );
}
