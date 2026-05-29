"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  text: string;
  /** Pixel size of the rendered SVG. Default 256. */
  size?: number;
  /** Foreground colour. Default `var(--color-fg)` via inline currentColor. */
  fg?: string;
  /** Background colour. Default transparent. */
  bg?: string;
  /** Aria label override. */
  ariaLabel?: string;
}

/**
 * Inline QR code renderer — uses `qrcode` to produce an SVG string, then
 * sets it as `innerHTML` on a div so the SVG renders crisply at any size.
 *
 * `text` is encoded with error-correction level "M" — ~15% damage
 * tolerance, the sweet spot for short URLs printed on phone screens.
 *
 * The component re-renders when `text` changes, so the share modal can
 * regenerate the slug without remounting the QR.
 */
export function QrCode({
  text,
  size = 256,
  fg = "#f5f7f8",
  bg = "#0c0f12",
  ariaLabel = "QR code",
}: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: fg, light: bg },
    })
      .then((out) => {
        if (cancelled) return;
        setSvg(out);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "QR render failed");
      });
    return () => {
      cancelled = true;
    };
  }, [text, fg, bg]);

  if (error) {
    return (
      <p className="font-mono text-xs text-[var(--color-amber)]" role="alert">
        [ ! ] {error}
      </p>
    );
  }

  if (!svg) {
    return (
      <div
        aria-busy
        className="font-mono text-xs text-[var(--color-fg-subtle)]"
        style={{ width: size, height: size }}
      >
        Rendering QR…
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      // The SVG produced by qrcode includes `width`/`height` attributes
      // we can override via inline style on the wrapper. Setting it as
      // innerHTML is safe — output is from a trusted library, not user
      // input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Returns the raw SVG markup for `text` — used by the Download SVG button
 * in the Share modal. Same encoding as `<QrCode />` so the saved file
 * matches what the user just scanned.
 */
export async function qrCodeToSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
}
