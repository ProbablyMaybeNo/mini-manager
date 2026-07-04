"use client";

import { useState, useTransition } from "react";
import { Button, Input, Panel } from "@/components/kit";

export interface ExtensionTokenPanelProps {
  /** Issue (or re-show) the current token. */
  onGenerate: () => Promise<{ ok: true; token: string } | { ok: false; error: string }>;
  /** Rotate the token, revoking any previously pasted one. */
  onRegenerate: () => Promise<{ ok: true; token: string } | { ok: false; error: string }>;
}

/**
 * Settings → "Browser extension" section. Generates the personal token
 * the "Mini Mainframe Collection" Chrome extension pastes in, with copy +
 * regenerate. The token is shown once on demand (never persisted to the
 * page on load) so it isn't sitting in the DOM for every account visit.
 */
export function ExtensionTokenPanel({
  onGenerate,
  onRegenerate,
}: ExtensionTokenPanelProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: typeof onGenerate) {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await action();
      if (res.ok) setToken(res.token);
      else setError(res.error);
    });
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the token is already
      // selectable in the field, so this is a soft failure.
      setError("Couldn’t copy automatically — select the token and copy it.");
    }
  }

  return (
    <Panel
      label="BROWSER EXTENSION"
      cornerTicks
      className="flex flex-col gap-4 p-5"
    >
      <p className="font-body text-body text-fg">
        The{" "}
        <span className="text-cyan-lite">Mini Mainframe Collection</span> browser
        extension lets you add a paint or model to your collection straight
        from a supported store’s product page. Generate a personal token below
        and paste it into the extension once.
      </p>

      {token ? (
        <Input
          label="Your token"
          name="extension-token"
          readOnly
          value={token}
          onFocus={(e) => e.currentTarget.select()}
          trailing={
            <button
              type="button"
              onClick={copy}
              className="shrink-0 font-osd text-xs text-cyan-lite hover:text-fg focus:outline-none"
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          }
        />
      ) : (
        <p className="font-body text-body text-fg-dim">
          No token shown. Generate one to set up the extension.
        </p>
      )}

      {error && (
        <p className="font-body text-body text-red-text" role="alert">
          ▸ {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(onGenerate)}
        >
          {pending ? "Working…" : token ? "Show token" : "Generate token"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run(onRegenerate)}
        >
          Regenerate
        </Button>
      </div>

      <p className="font-body text-body text-fg-faint">
        Regenerating invalidates the old token everywhere it’s pasted. Keep
        this token private — anyone with it can add items to your collection.
      </p>
    </Panel>
  );
}
