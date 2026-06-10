import type { ReactElement } from "react";

interface HeroProps {
  className?: string;
}

/** COLOR WHEEL — spiral pixel rainbow + analogous 3-swatch callout. */
export function WheelHero({ className }: HeroProps) {
  const swatches = ["#E63946", "#F4A261", "#2A9D8F"];
  return (
    <svg
      viewBox="0 0 160 88"
      className={className}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="wheel-arc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-red)" />
          <stop offset="25%" stopColor="var(--color-yellow)" />
          <stop offset="50%" stopColor="var(--color-green)" />
          <stop offset="75%" stopColor="var(--color-cyan)" />
          <stop offset="100%" stopColor="var(--color-purple-pastel)" />
        </linearGradient>
      </defs>
      <g transform="translate(44 44)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
          <rect
            key={deg}
            x={-4}
            y={-28}
            width={8}
            height={14}
            fill={`hsl(${deg} 75% 55%)`}
            transform={`rotate(${deg})`}
            opacity={0.85 - i * 0.04}
          />
        ))}
        <circle
          r={22}
          fill="none"
          stroke="url(#wheel-arc)"
          strokeWidth={3}
          strokeDasharray="4 3"
        />
        <circle r={6} fill="var(--color-bg)" stroke="var(--color-cyan)" strokeWidth={1.5} />
      </g>
      <g transform="translate(108 20)">
        <text
          x={0}
          y={0}
          fill="var(--color-fg-muted)"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.12em"
        >
          ANALOGOUS
        </text>
        {swatches.map((hex, i) => (
          <g key={hex} transform={`translate(0 ${14 + i * 18})`}>
            <rect x={0} y={0} width={28} height={12} fill={hex} stroke="var(--color-border)" />
            <text
              x={34}
              y={9}
              fill="var(--color-fg)"
              fontSize={8}
              fontFamily="ui-monospace, monospace"
            >
              {hex}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** COLOR MATCH — flowing phosphor curve bundle. */
export function MatchHero({ className }: HeroProps) {
  return (
    <svg viewBox="0 0 160 88" className={className} aria-hidden role="img">
      <path
        d="M8 72 C 32 20, 56 88, 80 44 S 128 12, 152 56"
        fill="none"
        stroke="var(--color-cyan)"
        strokeWidth={2}
        opacity={0.9}
      />
      <path
        d="M8 60 C 36 28, 60 76, 88 40 S 120 24, 152 48"
        fill="none"
        stroke="var(--color-yellow)"
        strokeWidth={1.5}
        opacity={0.55}
      />
      <path
        d="M8 48 C 40 36, 64 52, 96 36 S 132 20, 152 40"
        fill="none"
        stroke="var(--color-green)"
        strokeWidth={1}
        opacity={0.4}
      />
      {[24, 56, 88, 120].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={44 + (i % 2 === 0 ? -8 : 10)}
          r={3}
          fill="var(--color-cyan)"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

/** COLOR DROPPER — wireframe terrain + pin markers. */
export function EyedropperHero({ className }: HeroProps) {
  return (
    <svg viewBox="0 0 160 88" className={className} aria-hidden role="img">
      <polygon
        points="20,68 80,20 140,68 80,76"
        fill="none"
        stroke="var(--color-purple-pastel)"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <line x1={80} y1={20} x2={80} y2={76} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={20} y1={68} x2={140} y2={68} stroke="var(--color-border)" strokeWidth={1} />
      {[
        { x: 52, y: 48, hex: "#8B5CF6" },
        { x: 96, y: 40, hex: "#22D3EE" },
        { x: 72, y: 62, hex: "#FACC15" },
      ].map((pin) => (
        <g key={pin.hex}>
          <line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 14} stroke="var(--color-cyan)" strokeWidth={1} />
          <circle cx={pin.x} cy={pin.y - 14} r={4} fill={pin.hex} stroke="var(--color-fg)" strokeWidth={0.5} />
          <text
            x={pin.x + 6}
            y={pin.y - 10}
            fill="var(--color-fg-muted)"
            fontSize={7}
            fontFamily="ui-monospace, monospace"
          >
            {pin.hex}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** COLOR STACKING — overlapping translucent diamonds. */
export function GradientHero({ className }: HeroProps) {
  const layers = [
    { fill: "var(--color-red)", x: 48, opacity: 0.35 },
    { fill: "var(--color-yellow)", x: 64, opacity: 0.4 },
    { fill: "var(--color-green)", x: 80, opacity: 0.45 },
    { fill: "var(--color-cyan)", x: 96, opacity: 0.5 },
  ];
  return (
    <svg viewBox="0 0 160 88" className={className} aria-hidden role="img">
      {layers.map((layer) => (
        <polygon
          key={layer.x}
          points={`${layer.x},16 ${layer.x + 28},44 ${layer.x},72 ${layer.x - 28},44`}
          fill={layer.fill}
          fillOpacity={layer.opacity}
          stroke="var(--color-border)"
          strokeWidth={0.75}
        />
      ))}
    </svg>
  );
}

export const TOOL_HEROES: Record<
  "wheel" | "match" | "eyedropper" | "gradient",
  (props: HeroProps) => ReactElement
> = {
  wheel: WheelHero,
  match: MatchHero,
  eyedropper: EyedropperHero,
  gradient: GradientHero,
};
