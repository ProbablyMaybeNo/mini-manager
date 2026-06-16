/**
 * Bespoke SVG tool thumbnails (Vercel thread p9DIDc — "cooler/better visuals
 * for each of these tool thumbnails"). Hand-built phosphor-on-black graphics
 * styled to DESIGN_LANGUAGE — a pixel colour wheel, a cross-brand match
 * gradient, a dropper terrain plot, and stacked layer diamonds — instead of
 * the prior flat PNGs. Each maps to its tool's Figma reference frame.
 */

export function WheelThumb() {
  const wedges = Array.from({ length: 12 }, (_, i) => i);
  return (
    <Frame>
      <g transform="translate(80 45)">
        {wedges.map((i) => {
          const a0 = (i * 30 - 90) * (Math.PI / 180);
          const a1 = ((i + 1) * 30 - 90) * (Math.PI / 180);
          const r = 34;
          const x0 = Math.cos(a0) * r;
          const y0 = Math.sin(a0) * r;
          const x1 = Math.cos(a1) * r;
          const y1 = Math.sin(a1) * r;
          return (
            <path
              key={i}
              d={`M0 0 L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`}
              fill={`hsl(${i * 30} 90% 55%)`}
              stroke="#06080a"
              strokeWidth={1.5}
            />
          );
        })}
        <circle r={11} fill="#06080a" stroke="#00d2ff" strokeWidth={1.5} />
        <rect x={-4} y={-22} width={8} height={8} fill="#fff" stroke="#000" strokeWidth={1.5} />
      </g>
    </Frame>
  );
}

export function MatchThumb() {
  return (
    <Frame>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(14 ${14 + i * 12})`}>
          <rect width={18} height={8} fill={`hsl(210 ${30 + i * 15}% ${30 + i * 12}%)`} />
          <rect x={24} width={88} height={8} fill="#0b0f12" stroke="#51fd80" strokeWidth={0.5} />
          <rect x={24} width={88 - i * 16} height={8} fill="#51fd80" opacity={0.85} />
        </g>
      ))}
    </Frame>
  );
}

export function DropperThumb() {
  return (
    <Frame>
      {/* faux terrain / sample plot */}
      <g stroke="#00d2ff" strokeWidth={1} fill="none" opacity={0.6}>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <polyline
            key={r}
            points={Array.from({ length: 9 }, (_, c) => {
              const x = 12 + c * 14;
              const y = 30 + r * 9 - Math.sin(c * 0.9 + r) * 6;
              return `${x},${y}`;
            }).join(" ")}
          />
        ))}
      </g>
      {[
        ["#ff4244", 30, 26],
        ["#eef996", 72, 34],
        ["#9b80dc", 104, 24],
      ].map(([c, x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r={5} fill={c as string} stroke="#fff" strokeWidth={1} />
        </g>
      ))}
    </Frame>
  );
}

export function StackingThumb() {
  const colors = ["#00d2ff", "#51fd80", "#eef996", "#9b80dc", "#ff4244"];
  return (
    <Frame>
      <g transform="translate(80 45)">
        {colors.map((c, i) => (
          <rect
            key={i}
            x={-22 + i * 6}
            y={-22 + i * 6}
            width={44}
            height={44}
            transform="rotate(45)"
            fill={c}
            opacity={0.55}
            stroke="#06080a"
            strokeWidth={1}
          />
        ))}
      </g>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 90" className="h-full w-full" role="img" aria-hidden>
      <rect width={160} height={90} fill="#06080a" />
      {children}
    </svg>
  );
}

export const TOOL_THUMBS: Record<string, () => React.ReactElement> = {
  "/tools/wheel": WheelThumb,
  "/tools/match": MatchThumb,
  "/tools/dropper": DropperThumb,
  "/tools/stacking": StackingThumb,
};
