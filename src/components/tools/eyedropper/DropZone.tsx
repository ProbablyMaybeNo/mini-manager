"use client";

import { useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { validateImageBlob } from "@/lib/tools/eyedropper/sample";

interface Props {
  onFile: (file: Blob, displayUrl: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/**
 * Trio-input drop zone: drag-and-drop, paste from clipboard, or file
 * picker. Validates type + size before emitting. The parent owns the
 * decoded image + the URL it shows in the preview.
 */
export function DropZone({ onFile, onError, disabled }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleBlob = (blob: Blob) => {
    const err = validateImageBlob(blob);
    if (err) {
      onError(err);
      return;
    }
    const url = URL.createObjectURL(blob);
    onFile(blob, url);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setHovering(true);
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovering(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) handleBlob(file);
      }}
      onPaste={(e) => {
        if (disabled) return;
        const items = e.clipboardData?.items ?? [];
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              handleBlob(blob);
              return;
            }
          }
        }
      }}
      tabIndex={0}
      className={clsx(
        "frame-strong p-6 text-center cursor-pointer transition-colors",
        hovering
          ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)]"
          : "hover:border-[var(--color-cyan)]",
        disabled && "opacity-60 cursor-progress",
      )}
      role="button"
      aria-label="Drop image here, or click to pick a file, or paste from clipboard"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <div className="space-y-2">
        <p className="font-mono text-sm glow-cyan uppercase tracking-wider">
          Drop image here
        </p>
        <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
          Click to pick a file · or paste from clipboard ( Ctrl/⌘ + V )
        </p>
        <p className="text-2xs font-mono text-[var(--color-fg-subtle)]">
          JPG · PNG · WebP · GIF · up to 10 MB
        </p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBlob(file);
          // Reset so the painter can re-pick the same file.
          e.target.value = "";
        }}
      />
    </div>
  );
}
