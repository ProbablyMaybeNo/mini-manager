/**
 * Tool thumbnails (Vercel thread p9DIDc — "cooler/better visuals for each of
 * these tool thumbnails"). Phosphor-on-black art per tool, supplied as
 * black-background PNGs in `public/tools/*`. The cards sit on a black panel,
 * so `object-contain` shows each full image with no visible letterboxing.
 */
import Image from "next/image";
import type { ReactElement } from "react";

function Thumb({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      fill
      sizes="(max-width: 640px) 100vw, 50vw"
      className="object-contain"
    />
  );
}

export const TOOL_THUMBS: Record<string, () => ReactElement> = {
  "/tools/wheel": () => <Thumb src="/tools/wheel.png" />,
  "/tools/match": () => <Thumb src="/tools/match.png" />,
  "/tools/dropper": () => <Thumb src="/tools/dropper.png" />,
  "/tools/stacking": () => <Thumb src="/tools/stacking.png" />,
};
