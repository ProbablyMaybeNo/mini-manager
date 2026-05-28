"use client";

import { clsx } from "clsx";
import { useCallback } from "react";
import {
  INFANTRY_ZONES,
  type InfantryZoneId,
} from "@/lib/silhouettes/infantry";

interface PaintedZone {
  swatchHex: string;
}

interface Props {
  paintedZones: ReadonlyMap<InfantryZoneId, PaintedZone>;
  selectedZoneId: InfantryZoneId | null;
  onSelectZone: (id: InfantryZoneId) => void;
  className?: string;
}

/**
 * Hand-built front-view infantry silhouette. Each `<path>` covers one
 * canonical zone (see `INFANTRY_ZONES`). Zones don't overlap; tiny gaps
 * read as panel lines.
 *
 * Visual fidelity isn't the goal — at 200px wide every zone must be
 * recognisable and clickable. The cloak sits BEHIND the body so the
 * silhouette stays legible without z-fighting.
 *
 * Renders inline (no lazy-load) and keeps total path data well under
 * the 8KB budget. Keyboard tab cycles through every zone in DOM order;
 * Enter / Space activates `onSelectZone`.
 */

interface ZonePathDef {
  id: InfantryZoneId;
  d: string;
}

/**
 * Path order matters: earlier paths render behind later ones. Cloak
 * first (back), then body parts on top of it, then helmet on top of
 * head, then weapons + base.
 */
const PATHS: readonly ZonePathDef[] = [
  // Cloak — wide trapezoid behind the figure
  {
    id: "cloak",
    d: "M 130 220 L 470 220 L 510 660 L 90 660 Z",
  },
  // Base — flat oval at the bottom
  {
    id: "base",
    d: "M 110 700 L 490 700 L 470 760 L 130 760 Z",
  },
  // Head / Face — round-topped trapezoid (lower portion of head only;
  // helmet covers the dome)
  {
    id: "head",
    d: "M 245 110 L 355 110 L 355 175 Q 300 200 245 175 Z",
  },
  // Helmet — top of head + face plate
  {
    id: "helmet",
    d: "M 240 60 Q 300 30 360 60 L 365 115 L 235 115 Z",
  },
  // Skin — neck + hands (two small disjoint regions in one path)
  {
    id: "skin",
    // neck
    d: "M 260 175 L 340 175 L 330 215 L 270 215 Z " +
       // left hand
       "M 95 470 L 135 470 L 135 510 L 95 510 Z " +
       // right hand
       "M 465 470 L 505 470 L 505 510 L 465 510 Z",
  },
  // Armor Primary — torso chest plate
  {
    id: "armor-primary",
    d: "M 225 215 L 375 215 L 395 380 L 205 380 Z",
  },
  // Armor Secondary — pauldrons (shoulders) + thigh guards
  {
    id: "armor-secondary",
    // left pauldron
    d: "M 150 220 Q 175 200 225 215 L 225 290 L 150 290 Z " +
       // right pauldron
       "M 375 215 Q 425 200 450 220 L 450 290 L 375 290 Z " +
       // left thigh
       "M 215 400 L 295 400 L 295 540 L 220 540 Z " +
       // right thigh
       "M 305 400 L 385 400 L 380 540 L 305 540 Z",
  },
  // Armor Trim — belt + collar + boot rims
  {
    id: "armor-trim",
    // belt
    d: "M 205 380 L 395 380 L 395 400 L 205 400 Z " +
       // collar
       "M 250 200 L 350 200 L 350 215 L 250 215 Z " +
       // left boot rim
       "M 215 660 L 295 660 L 295 680 L 215 680 Z " +
       // right boot rim
       "M 305 660 L 385 660 L 385 680 L 305 680 Z",
  },
  // Leather — straps across torso + pouches
  {
    id: "leather",
    // chest strap (diagonal)
    d: "M 225 230 L 250 230 L 380 360 L 355 360 Z " +
       // belt pouch left
       "M 220 400 L 270 400 L 270 440 L 220 440 Z " +
       // belt pouch right
       "M 330 400 L 380 400 L 380 440 L 330 440 Z",
  },
  // Weapon Main — long rifle held diagonally across right side
  {
    id: "weapon-main",
    d: "M 500 320 L 540 320 L 555 600 L 515 600 Z",
  },
  // Weapon Secondary — sidearm on hip (left side)
  {
    id: "weapon-secondary",
    d: "M 60 420 L 110 420 L 115 510 L 55 510 Z",
  },
  // Weapon Metal — barrel + muzzle highlights on the main weapon
  {
    id: "weapon-metal",
    // muzzle
    d: "M 510 305 L 545 305 L 540 325 L 515 325 Z " +
       // grip plate
       "M 515 500 L 555 500 L 555 525 L 515 525 Z",
  },
];

const VIEW_W = 600;
const VIEW_H = 800;

const ZONE_NAME_BY_ID = Object.fromEntries(
  INFANTRY_ZONES.map((z) => [z.id, z.name]),
) as Record<InfantryZoneId, string>;

export function InfantrySilhouette({
  paintedZones,
  selectedZoneId,
  onSelectZone,
  className,
}: Props) {
  const handleKey = useCallback(
    (event: React.KeyboardEvent<SVGPathElement>, id: InfantryZoneId) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelectZone(id);
      }
    },
    [onSelectZone],
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={clsx("w-full h-auto", className)}
      role="img"
      aria-label="Infantry silhouette — zone picker"
    >
      {/* Subtle background panel — phosphor-on-near-black */}
      <rect
        x={0}
        y={0}
        width={VIEW_W}
        height={VIEW_H}
        fill="var(--color-bg-panel)"
      />
      {PATHS.map((path) => {
        const painted = paintedZones.get(path.id);
        const fill = painted?.swatchHex ?? "var(--color-bg-elevated)";
        const isSelected = selectedZoneId === path.id;
        const isPainted = Boolean(painted);
        const stroke = isSelected
          ? "var(--color-cyan)"
          : isPainted
            ? "var(--color-border-strong)"
            : "var(--color-border)";
        return (
          <path
            key={path.id}
            d={path.d}
            data-zone-id={path.id}
            role="button"
            tabIndex={0}
            aria-label={ZONE_NAME_BY_ID[path.id]}
            aria-pressed={isSelected}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 3 : 1.5}
            style={{
              cursor: "pointer",
              filter: isSelected
                ? "drop-shadow(0 0 6px var(--color-cyan))"
                : undefined,
              transition: "stroke-width 120ms ease, filter 120ms ease",
            }}
            onClick={() => onSelectZone(path.id)}
            onKeyDown={(event) => handleKey(event, path.id)}
            onMouseEnter={(event) => {
              if (!isSelected) {
                event.currentTarget.setAttribute(
                  "stroke",
                  "var(--color-cyan)",
                );
              }
            }}
            onMouseLeave={(event) => {
              if (!isSelected) {
                event.currentTarget.setAttribute("stroke", stroke);
              }
            }}
          >
            <title>{ZONE_NAME_BY_ID[path.id]}</title>
          </path>
        );
      })}
    </svg>
  );
}
