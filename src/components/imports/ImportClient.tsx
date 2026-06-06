"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { createFileImport, createTextImport } from "@/lib/actions/imports";
import { Button } from "@/components/ui/Button";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PASTE_CHARS = 20_000;
const ACCEPTED_EXTS = [".pdf", ".ros", ".rosz", ".json"] as const;

export function ImportClient() {
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onSubmitPaste = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const text = pasted.trim();
    if (text.length === 0) {
      setError("Paste your army list first.");
      return;
    }
    if (text.length > MAX_PASTE_CHARS) {
      setError(
        `Lists longer than ${MAX_PASTE_CHARS.toLocaleString()} characters aren't supported. Trim it down or import the source file directly.`,
      );
      return;
    }
    startTransition(async () => {
      const result = await createTextImport({ rawText: text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/projects/import/${result.data.importId}/preview`);
    });
  };

  const onFileSelected = (file: File) => {
    setError(null);
    if (file.size === 0) {
      setError("File is empty.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`,
      );
      return;
    }
    const ext = `.${file.name.toLowerCase().split(".").pop() ?? ""}`;
    if (!ACCEPTED_EXTS.includes(ext as (typeof ACCEPTED_EXTS)[number])) {
      setError(
        `Unsupported file type "${ext}". Use one of: ${ACCEPTED_EXTS.join(", ")}.`,
      );
      return;
    }

    startTransition(async () => {
      try {
        const base64 = await fileToBase64(file);
        const result = await createFileImport({
          filename: file.name,
          base64,
          size: file.size,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/projects/import/${result.data.importId}/preview`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not read the file.",
        );
      }
    });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="space-y-6">
      {/* Drop-file section — a terminal panel with a top-border label +
          corner registration ticks, so the drop target reads as a CRT
          ingest bay rather than a plain dashed SaaS box. The cyan phosphor
          tint lifts on drag-over. */}
      <section className="space-y-3">
        <h2 className="section-title mb-0">Drop file</h2>
        <div
          className={clsx(
            "panel panel-nested panel-ticks p-8 text-center transition-colors motion-reduce:transition-none",
            dragging
              ? "border-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
              : null,
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="panel-label" aria-hidden>
            INGEST ▸ FILE
          </span>
          <p className="text-sm font-mono mb-2">
            Drop a <strong>.pdf</strong>, <strong>.ros</strong>,{" "}
            <strong>.rosz</strong>, or <strong>.json</strong> file here
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] font-sans mb-6">
            Up to 5 MB. We parse it server-side; nothing leaves to a third
            party except, for very messy plain-text, an Anthropic API call.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTS.join(",")}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelected(f);
              // reset so re-picking the same file fires onChange again
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            variant="warning"
            size="sm"
          >
            {isPending ? "Parsing…" : "Choose file"}
          </Button>
        </div>
      </section>

      {/* Paste-list section — standalone, always visible below drop-file.
          The textarea sits inside a phosphor-bordered terminal panel with a
          top-border label, so a pasted list reads as a CLI buffer. */}
      <section className="space-y-3">
        <h2 className="section-title mb-0">Paste list</h2>
        <form className="space-y-3" onSubmit={onSubmitPaste}>
          <label htmlFor="paste-list" className="sr-only">
            Paste list
          </label>
          <div className="panel relative focus-within:border-[var(--color-cyan)] transition-colors motion-reduce:transition-none">
            <span className="panel-label" aria-hidden>
              BUFFER ▸ PASTE
            </span>
            <textarea
              id="paste-list"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={`## My Army\n10x Intercessors - 200pts\n5x Terminators - 185pts\nCaptain - 105pts`}
              rows={12}
              maxLength={MAX_PASTE_CHARS}
              className="block w-full p-3 font-mono text-xs bg-transparent text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none resize-y border-0"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--color-fg-muted)]">
              {pasted.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} chars
            </span>
            <Button
              type="submit"
              disabled={isPending || pasted.trim().length === 0}
              variant="warning"
              size="sm"
            >
              {isPending ? "Parsing…" : "Parse list"}
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <p
          role="alert"
          className="text-sm font-mono text-[var(--color-amber)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked binary-string build to avoid blowing the call-stack on
  // large-ish files. 32 KB chunks are fine for the 5 MiB ceiling.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
