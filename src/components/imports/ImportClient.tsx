"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { createFileImport, createTextImport } from "@/lib/actions/imports";
import { Button } from "@/components/ui/Button";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PASTE_CHARS = 20_000;
const ACCEPTED_EXTS = [".pdf", ".ros", ".rosz"] as const;

type Mode = "drop" | "paste";

interface SampleList {
  label: string;
  hint: string;
  body: string;
}

const SAMPLE_LISTS: ReadonlyArray<SampleList> = [
  {
    label: "Sample · 40k Marines (WTC)",
    hint: "Tournament-style export, 10 units",
    body: `## Ultramarines Strike Force
Faction: Adeptus Astartes
Points Limit: 2000

Captain in Terminator Armour - 105pts
Lieutenant - 65pts
10x Intercessors - 200pts
10x Assault Intercessors - 200pts
5x Terminators - 185pts
10x Tactical Marines - 135pts
Redemptor Dreadnought - 210pts
Repulsor Executioner - 220pts
3x Eradicators - 100pts
5x Sternguard Veterans - 130pts
`,
  },
  {
    label: "Sample · AoS Stormcast",
    hint: "NewRecruit-style export, 11 units",
    body: `# Hammers of Sigmar
Total: 2000pts

* Lord-Imperatant (185)
* Knight-Arcanum (130)
* Liberators x10 — 200pts
* Liberators x10 — 200pts
* Vindictors x10 — 200pts
* Praetors x3 — 220pts
* Annihilators x3 — 250pts
* Vanquishers x5 — 130pts
* Stormstrike Chariot (155)
`,
  },
  {
    label: "Sample · Orks",
    hint: "Goonhammer-style with bracket points",
    body: `**Goff Waaagh!**
Faction: Orks
1990pts

- Warboss [80]
- Big Mek with Shokk Attack Gun [100]
- 20 Boyz [180]
- 20 Boyz [180]
- 10 Beast Snagga Boyz [110]
- 5 Nobz [125]
- 6 Meganobz [240]
- 3 Killa Kans [135]
`,
  },
];

export function ImportClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("drop");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onSampleSelect = useCallback((label: string) => {
    const found = SAMPLE_LISTS.find((s) => s.label === label);
    if (!found) return;
    setMode("paste");
    setPasted(found.body);
    setError(null);
  }, []);

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
      <div role="tablist" aria-label="Import method" className="flex gap-2 text-xs font-mono uppercase tracking-wider">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "drop"}
          onClick={() => {
            setMode("drop");
            setError(null);
          }}
          className={clsx(
            "px-4 py-2 min-h-[36px] font-mono text-sm uppercase tracking-[0.04em] rounded-sm border transition-colors",
            mode === "drop"
              ? "border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
              : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]",
          )}
        >
          Drop file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          onClick={() => {
            setMode("paste");
            setError(null);
          }}
          className={clsx(
            "px-4 py-2 min-h-[36px] font-mono text-sm uppercase tracking-[0.04em] rounded-sm border transition-colors",
            mode === "paste"
              ? "border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
              : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]",
          )}
        >
          Paste text
        </button>
      </div>

      {mode === "drop" ? (
        <div
          role="tabpanel"
          className={clsx(
            "frame-strong p-8 text-center transition-colors",
            dragging && "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="text-sm font-mono mb-2">
            Drop a <strong>.pdf</strong>, <strong>.ros</strong>, or{" "}
            <strong>.rosz</strong> file here
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
            variant="primary"
            size="md"
          >
            {isPending ? "Parsing…" : "Choose file"}
          </Button>
        </div>
      ) : (
        <form
          role="tabpanel"
          className="space-y-3"
          onSubmit={onSubmitPaste}
        >
          <label
            htmlFor="paste-list"
            className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
          >
            Paste your list
          </label>
          <textarea
            id="paste-list"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={`## My Army\n10x Intercessors - 200pts\n5x Terminators - 185pts\nCaptain - 105pts`}
            rows={14}
            maxLength={MAX_PASTE_CHARS}
            className="w-full p-3 frame font-mono text-xs bg-transparent text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--color-fg-muted)]">
              {pasted.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} chars
            </span>
            <Button
              type="submit"
              disabled={isPending || pasted.trim().length === 0}
              variant="primary"
              size="md"
            >
              {isPending ? "Parsing…" : "Parse list"}
            </Button>
          </div>
        </form>
      )}

      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Try a sample
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_LISTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSampleSelect(s.label)}
              className="px-3 py-1.5 frame tap-target text-xs font-mono hover:text-[var(--color-cyan)]"
              title={s.hint}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

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
